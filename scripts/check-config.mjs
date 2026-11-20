#!/usr/bin/env node
// 檢查 index.html 的 CONFIG，並可依 CONFIG.users 產生對應的 Firestore 安全規則。
//
// 用法：
//   node scripts/check-config.mjs [index.html]
//   node scripts/check-config.mjs index.html --write-rules firestore.rules
//
// 結束代碼：0 = 沒有錯誤（可能有警告）；1 = 有錯誤；2 = 找不到 CONFIG
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const wi = args.indexOf('--write-rules');
const rulesOut = wi > -1 ? (args[wi + 1] ?? 'firestore.rules') : null;
const skip = wi > -1 ? wi + 1 : -1;   // --write-rules 後面接的是輸出檔名，不是輸入檔
const file = args.find((a, i) => !a.startsWith('--') && i !== skip) ?? 'index.html';

const html = readFileSync(file, 'utf8');

// ── 從 HTML 取出 CONFIG 物件（略過字串與註解裡的大括號）──────────────
function extractObject(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return null;
  let i = src.indexOf('{', start + marker.length);
  const begin = i;
  let depth = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) return src.slice(begin, i + 1); }
    i++;
  }
  return null;
}

const text = extractObject(html, 'const CONFIG =');
if (!text) { console.error(`✗ 在 ${file} 找不到 CONFIG 區塊`); process.exit(2); }
let CONFIG;
try { CONFIG = new Function(`return (${text})`)(); }
catch (e) { console.error('✗ CONFIG 不是合法的 JavaScript：' + e.message); process.exit(2); }

let errors = 0, warnings = 0;
const err = (s) => { console.error('✗ ' + s); errors++; };
const warn = (s) => { console.warn('! ' + s); warnings++; };

// ── 1. 參與者名單（顯示名稱會當作 Firestore 文件 ID）────────────────
const users = CONFIG.users;
if (!Array.isArray(users) || users.length === 0) {
  err('CONFIG.users 必須是非空陣列，例如 ["小明", "小華"]');
} else {
  const seen = new Set();
  for (const u of users) {
    if (typeof u !== 'string' || u.trim() === '') { err(`參與者名稱必須是非空字串：${JSON.stringify(u)}`); continue; }
    if (seen.has(u)) err(`參與者名稱重複：「${u}」`);
    seen.add(u);
    if (u.includes('/')) err(`參與者名稱不可包含「/」：「${u}」`);
    if (u === '.' || u === '..') err(`參與者名稱不可是「.」或「..」：「${u}」`);
    if (/^__.*__$/.test(u)) err(`參與者名稱不可是 __xxx__ 格式（Firestore 保留）：「${u}」`);
    if (u !== u.trim()) warn(`參與者名稱前後有空白：「${u}」`);
    if (/["\\]/.test(u)) err(`參與者名稱不可包含雙引號或反斜線（會讓 Firestore 規則出錯）：「${u}」`);
  }
  console.log(`users: ${users.length} 位`);
}

// ── 2. 去程／返程：座位 ↔ 票券一一對應 ───────────────────────────────
for (const trip of ['outbound', 'return']) {
  const t = CONFIG[trip];
  if (!t || !Array.isArray(t.seats) || typeof t.tickets !== 'object') { err(`${trip} 缺少 seats 或 tickets`); continue; }
  const seatIds = new Set();
  t.seats.forEach((row, ri) => {
    for (const side of ['left', 'right']) {
      if (!Array.isArray(row[side])) { err(`${trip} 第 ${ri + 1} 列缺少 ${side}（需為 2 格的陣列，可用 null 或 { isGhost: true } 補齊）`); continue; }
      if (row[side].length > 2) { err(`${trip} 第 ${ri + 1} 列的 ${side} 有 ${row[side].length} 格，但畫面只會顯示前 2 格`); continue; }
      if (row[side].length < 2) warn(`${trip} 第 ${ri + 1} 列的 ${side} 只有 ${row[side].length} 格（缺的會顯示為空格）`);
      for (const s of row[side]) {
        if (s === null || (s && s.isGhost)) continue;
        if (!s || s.no === undefined || s.car === undefined) { err(`${trip} 第 ${ri + 1} 列有格式錯誤的座位：${JSON.stringify(s)}`); continue; }
        if (typeof s.no !== 'string' || typeof s.car !== 'string') warn(`${trip} 座位 car/no 建議用字串：${JSON.stringify(s)}`);
        const id = `${s.car}-${s.no}`;
        if (seatIds.has(id)) err(`${trip} 座位重複：${id}`);
        seatIds.add(id);
      }
    }
  });
  const ticketIds = new Set(Object.keys(t.tickets));
  for (const id of seatIds) if (!ticketIds.has(id)) err(`${trip} 座位 ${id} 沒有對應的票券（tickets 的 key 必須是「車廂號-座位號」）`);
  for (const id of ticketIds) {
    if (!seatIds.has(id)) err(`${trip} 票券 ${id} 沒有對應的座位`);
    const v = t.tickets[id];
    if (!v || !v.code || !v.verify) err(`${trip} 票券 ${id} 必須同時有 code 與 verify`);
  }
  if (!Array.isArray(t.info) || t.info.length === 0) warn(`${trip}.info 是空的`);
  console.log(`${trip}: ${seatIds.size} 個座位, ${ticketIds.size} 筆票券`);
}

// ── 3. 座位數量與人數 ───────────────────────────────────────────────
if (Array.isArray(users)) {
  for (const trip of ['outbound', 'return']) {
    const n = Object.keys(CONFIG[trip]?.tickets ?? {}).length;
    if (n < users.length) warn(`${trip} 只有 ${n} 個座位，但有 ${users.length} 位參與者（有人會選不到）`);
  }
}

// ── 4. 預留值（部署前必須全部換掉）─────────────────────────────────
const placeholders = [];
(function walk(o, p) {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (typeof v === 'string' && /YOUR_|XXXXXXX/.test(v)) placeholders.push(p + k);
    else if (v && typeof v === 'object') walk(v, p + k + '.');
  }
})(CONFIG, '');
const fb = CONFIG.firebase ?? {};
for (const k of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']) if (!fb[k]) err(`firebase.${k} 是空的`);
if (placeholders.length) warn(`仍有 ${placeholders.length} 個欄位是預留值（填完前可忽略，部署前必須換掉）：` + placeholders.slice(0, 8).join(', ') + (placeholders.length > 8 ? ' …' : ''));

// ── 5. 產生 Firestore 規則 ─────────────────────────────────────────
if (rulesOut) {
  if (errors) { console.error('\n因為有錯誤，未產生規則檔。'); }
  else {
    const list = users.map((u) => JSON.stringify(u)).join(', ');
    writeFileSync(rulesOut, `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 白名單：必須與 index.html 的 CONFIG.users 完全一致
    // （此檔由 scripts/check-config.mjs 依 CONFIG.users 產生；名單變動後請重新產生並發布）
    function isValidUser(name) {
      return name in [${list}];
    }

    // 座位認領表：所有人可讀寫、禁止刪除
    match /config/seats {
      allow read: if true;
      allow create, update: if true;
      allow delete: if false;
    }

    // 個人進度與截圖：名稱必須在白名單內；截圖字串限制在 1,000,000 字元內；禁止刪除
    match /users/{userId} {
      allow read: if true;
      allow create, update: if isValidUser(userId)
                           && (!("screenshotBase64" in request.resource.data)
                               || request.resource.data.screenshotBase64.size() < 1000000);
      allow delete: if false;
    }
  }
}
`);
    console.log(`已寫入 ${rulesOut}`);
  }
}

console.log(errors ? `\n發現 ${errors} 個錯誤、${warnings} 個警告` : `\n結構檢查通過（${warnings} 個警告）`);
process.exit(errors ? 1 : 0);
