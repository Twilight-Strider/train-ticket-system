# AGENTS.md — 給 AI Agent 的部署指南

本文件寫給能操作終端機與檔案的 AI Agent（Claude Code、Codex 等）。目標：**協助使用者從這個 repo 部署出一份屬於他們自己的「火車選位分票系統（選擇身份版）」**。人類讀者請看 [README.md](README.md)。

## 0. 專案一句話

單一 `index.html`（React 18 + Babel + Tailwind，全部走 CDN）＋ Firebase **Cloud Firestore**。**本版沒有登入**：使用者在下拉選單選自己的名字。所有客製化都集中在 `index.html` 上方的 `const CONFIG = { ... }`；其下方標示「以下程式碼不需要修改」的部分**不要改**。

> 如果使用者需要用 Google 帳號驗證身分，請告訴他改用 Google 登入版：https://github.com/Twilight-Strider/train-ticket-system_Google-login-version （本 repo 的部署步驟不適用於該版本）。

## 1. 鐵則（先讀）

1. **先讓使用者了解這個版本的安全模型，再開始部署**：沒有身分驗證（任何人可選任何名字）、票券代碼寫在前端（任何人可「檢視原始碼」看到）、所有人的進度與截圖對知道專案設定的人是公開可讀的。要明確說出這三點，並確認使用者接受；若他在意，建議改用 Google 登入版。
2. **不要索取或儲存使用者的 Google 密碼、Token、服務帳戶金鑰。** 登入一律由使用者自己在瀏覽器／`firebase login` 的互動流程完成。
3. **不要把填了真實票券代碼、驗證碼的 `index.html` 提交或推送到公開 repo，也不要發布到公開的 GitHub Pages。** 若使用者要求，先提醒風險，並建議改用 Firebase Hosting / 私人 repo。
4. **Firestore 規則必須是第 5.4 節由腳本產生的版本**。**不得**使用測試模式或 `allow read, write: if true`。
5. `CONFIG.users` 是**名稱陣列**（不是 Email）。名稱會當作 Firestore 文件 ID：不可重複、不可含 `/`、不可是 `.`／`..`／`__xxx__`、不要含雙引號或反斜線。
6. **修改 `CONFIG.users` 後，必須重新產生並部署 Firestore 規則**（兩者要一致）。
7. 刪除資料、覆寫使用者既有檔案、`git push`、`firebase deploy` 到使用者已有的專案之前，先取得使用者明確同意。
8. 不要自行編造票券代碼、名稱、車次；缺資料就問。
9. 每個 `firebase` 指令都明確加上 `--project <ID>`，避免誤改使用者的其他專案；不要使用互動式的 `firebase use --add`。
10. 不要執行本文件沒有寫、且會產生費用或影響其他專案的指令。

## 2. 分工：哪些你能做、哪些必須請人類做

| 步驟 | 誰做 | 備註 |
|------|------|------|
| 安裝 `node`、`firebase-tools`、`git` | Agent | `npm install -g firebase-tools` |
| `firebase login` | **人類** | 互動式；無瀏覽器環境用 `firebase login --no-localhost` |
| 建立 Firebase 專案、Web App、Firestore | Agent（CLI） | 也可請人類在 Console 做 |
| 編輯 `CONFIG`、準備 `images/` | Agent | 資料由人類提供 |
| 檢查設定、產生並部署 Firestore 規則 | Agent | 第 5.4～5.5 節 |
| 部署 Hosting | Agent | 需人類同意 |
| 在 Cloudflare Pages 等其他平台發布 | **人類** | 依平台流程 |
| 多人搶位、真實裝置測試 | **人類** | Agent 無法代為操作使用者的裝置 |

遇到「人類」步驟時，**停下來**，給出明確的操作指引，等使用者回覆完成再繼續。

## 3. 需要向使用者蒐集的資訊

一次問齊，不要零碎地問：

| 項目 | 格式／說明 |
|------|------------|
| 參與者名單 | 每人一個顯示名稱（例：`小明`）。**不需要 Email** |
| 去程資訊 | 車次、車型、乘車時間（三行文字顯示在選位頁） |
| 去程座位圖 | 每個座位的車廂號與座位號，以及它們在「左 2 格＋右 2 格」座位圖中的排列。若使用者只給座位清單，請先與他確認排列方式 |
| 去程票券 | 每個座位的「訂票代碼」「取票驗證碼」 |
| 返程資訊／座位圖／票券 | 同上 |
| 行程表 PDF | Google Drive 檔案 ID（且已設為「知道連結的任何人可檢視」）。沒有的話先確認要不要保留行程表頁面 |
| Firebase 專案 ID | 新專案：全域唯一，6～30 字元，小寫英文、數字、連字號。或使用者既有專案 ID |
| Firestore 區域 | 預設建議 `asia-east1`（台灣）；可用 `firebase firestore:locations` 列出。**建立後無法更改** |
| 部署目標 | Firebase Hosting（預設建議）／Cloudflare Pages／其他，以及網站最終網域 |
| 圖片 | `images/Google_Play.png`、`images/App_Store.png`、`images/upload_info.jpg`；以及是否要替換 `helpImageUrl` 的取票教學圖（見第 5.3 節） |

## 4. 前置檢查

```bash
node --version        # 建議 18 以上
git --version
npm install -g firebase-tools   # 或使用 npx firebase-tools
firebase --version
```

工作目錄：這個 repo 的根目錄（含 `index.html` 與 `scripts/check-config.mjs`）。若缺少其中任何一個，停止並告知使用者。

## 5. 部署步驟

以下以 `<ID>` 代表 Firebase 專案 ID。

### 5.1 建立專案與 Web App

```bash
firebase login                                   # 人類完成互動登入
firebase projects:create <ID> --display-name "火車分票"
firebase apps:create WEB "train-ticket" --project <ID>      # 輸出會包含 App ID
firebase apps:sdkconfig WEB <APP_ID> --project <ID>         # 輸出 firebaseConfig
```

把 `apps:sdkconfig` 輸出的欄位填進 `CONFIG.firebase`：`apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId`。`measurementId` 若沒有輸出就**移除該欄位**（程式沒有使用它）。

> 如果使用者要用既有專案，跳過 `projects:create`。

### 5.2 建立 Firestore

```bash
firebase firestore:locations --project <ID>                  # 可選：列出可用區域
firebase firestore:databases:create '(default)' --location=asia-east1 --project <ID>
```

以上指令已對照 firebase-tools 15.x 的 `--help` 確認存在，但**沒有對真實專案執行過**。若指令失敗（版本太舊、資料庫已存在），改請人類在 Console：Build → Firestore Database → Create database → **Production mode**。

### 5.3 編輯 `index.html`

只修改 `CONFIG` 區塊：

1. `users`：名稱陣列，例如 `["小明", "小華", "小美"]`。
2. `outbound` / `return`：`info`（三行文字）、`seats`（座位圖）、`tickets`（票券對照）。
   - 座位圖每列 `left`、`right` 各 2 格：`{ no, car }` 實際座位、`{ isGhost: true }` 空白框、`null` 空白。
   - `tickets` 的 key 必須是 `車廂號-座位號`，與座位圖中每個實際座位一一對應。
3. `schedule`：把 `YOUR_FILE_ID` 換成行程表的 Drive 檔案 ID（兩處）。
4. `firebase`：第 5.1 節取得的值。

選用：

- 替換 `<title>`、`og:title`、`og:description`。
- **`helpImageUrl`**（步驟 2、3「App 取票教學」圖）預設指向第三方網站的圖片，建議請使用者提供自己的圖片並替換；`images/upload_info.jpg` 也不一定是使用者自己的素材，需向使用者確認。
- **干擾除錯**：`index.html` 內有兩段「凍結核心物件」與「干擾除錯 (Anti-Debugging)」的 `<script>`，後者會讓開發者工具每秒被暫停一次，且只是嚇阻、不提供安全性。請詢問使用者是否要移除，**不要自行刪除**。

### 5.4 檢查設定並產生 Firestore 規則

```bash
node scripts/check-config.mjs index.html --write-rules firestore.rules
```

- 腳本會檢查：座位與票券一一對應、座位無重複、名稱合法且不重複、座位數是否夠人數，並警告仍是預留值（`YOUR_...`、`XXXXXXX`）的欄位。
- **有任何 `✗` 錯誤就先修正，不要部署**（有錯誤時腳本不會產生規則檔）。
- 預留值警告（`!`）在填完前可忽略，但**部署前必須全部消失**。
- 通過後會依 `CONFIG.users` 產生 `firestore.rules`。

**這個規則的含意要如實告訴使用者**：名單外的名稱不能寫入、刪除一律禁止；但讀取是開放的，座位表任何人都能改。

### 5.5 部署規則與網站

建立 `firebase.json`（如果還沒有）：

```json
{
  "firestore": { "rules": "firestore.rules" },
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json", "firestore.rules", "**/.*", "**/node_modules/**",
      "scripts/**", "README.md", "AGENTS.md", "LICENSE"
    ]
  }
}
```

部署規則（先取得使用者同意）：

```bash
firebase deploy --only firestore:rules --project <ID>
```

**先在本機驗證（第 5.6 節）再部署網站**：

```bash
firebase deploy --only hosting --project <ID>
```

網址通常為 `https://<ID>.web.app` 與 `https://<ID>.firebaseapp.com`。使用 Cloudflare Pages 等其他平台時，由**使用者**依平台流程發布。

部署前再次確認：這份要發布的 repo／網站**是否含有真實票券資料**（鐵則 3）。

### 5.6 本機測試

```bash
python3 -m http.server 8000
```

請使用者在 `http://localhost:8000` 測試。如果你的環境有瀏覽器自動化工具，可以先開啟該頁面，確認 `#root` 有內容、Console 沒有 `Unexpected token`（`CONFIG` 一有語法錯誤，整個頁面會是白畫面）。

## 6. 驗收

自動可做的（把 `<ID>` 與 `<API_KEY>` 換成 `CONFIG.firebase` 的值）：

```bash
# 不在名單內的名稱不得寫入（預期 403）
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H "Content-Type: application/json" -d '{"fields":{}}' \
  "https://firestore.googleapis.com/v1/projects/<ID>/databases/(default)/documents/users/not-in-the-list?key=<API_KEY>"

# 座位表不得被刪除（預期 403）
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  "https://firestore.googleapis.com/v1/projects/<ID>/databases/(default)/documents/config/seats?key=<API_KEY>"

# 網站可連線（預期 200）
curl -s -o /dev/null -w "%{http_code}\n" https://<網站網域>/
```

> 這些預期結果是依規則邏輯推得的；若得到非 403／200，請照實回報並排查，不要宣稱通過。

必須請使用者手動確認的：

- [ ] 選一個名字並進入，能看到安裝 App 頁面
- [ ] 兩人同時選同一座位，只有一人成功；另一人的畫面即時更新
- [ ] 改選另一個座位後，舊座位恢復為可選
- [ ] 去程、返程的票券代碼與驗證碼正確（不是「未設定」）
- [ ] 上傳一張大於 1 MB 的截圖成功並進入完成頁（確認自動壓縮正常）
- [ ] 重新整理後選同一個名字並確認，會回到上次的步驟
- [ ] 行程表 PDF 可預覽與下載

全部通過才算完成；回報時請列出：網站網址、Firebase 專案 ID、做了哪些人類步驟、哪些項目尚未驗證，以及使用者需要知道的安全限制（鐵則 1）。

## 7. 疑難排解對照

| 現象 | 處理 |
|------|------|
| 白畫面 | 先用瀏覽器 Console 看錯誤：`Unexpected token` → `CONFIG` 語法錯誤（逗號、引號、括號）；載入失敗 → 連不到 CDN；開發者工具被 `debugger` 暫停 → 見第 5.3 節 |
| `Missing or insufficient permissions` | 規則的名單與 `CONFIG.users` 不一致，或規則未發布 → 重跑 5.4 並重新部署規則 |
| 座位沒有即時更新 | 檢查 `firebase` 設定是否填對；規則是否已發布 |
| 票券顯示「未設定」 | `tickets` key 與座位 `車廂號-座位號` 不一致 → 重跑檢查腳本 |
| 圖片破圖 | `images/` 缺檔，或沒有一起部署 |
| `firebase firestore:databases:create` 失敗 | 資料庫可能已存在，或 CLI 版本太舊；改用 Console |
| `projects:create` 失敗 | 專案 ID 已被使用或不合規；換一個 |
| `firebase deploy` 說找不到規則檔 | 確認 `firebase.json` 的 `firestore.rules` 路徑，且已執行 5.4 產生 `firestore.rules` |

## 8. 不要做的事（再次提醒）

- 不要放寬 Firestore 規則來「讓它先動起來」。
- 不要修改 `CONFIG` 以外的邏輯來「修正」使用者的資料問題（例如替他補不存在的票券）。
- 不要在對話、commit 訊息或日誌中輸出使用者的票券代碼與名單。
- 不要在沒有同意的情況下刪除 Firestore 資料或 Firebase 專案。
- 不要把填了真實資料的 `index.html`、或由它產生的 `firestore.rules` 提交到公開 repo。
