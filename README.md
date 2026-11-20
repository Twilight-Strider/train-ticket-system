# 🎫 火車選位分票系統（選擇身份版）

一個給「團體購票」使用的協作小工具：由一個人把整批車票訂好之後，成員各自**選擇自己的名字**，挑選座位並取得該座位的訂票代碼與取票驗證碼，再到各自的手機 App 完成取票。

整個系統是**單一 `index.html`**，沒有打包工具、沒有自己的伺服器，後端完全交給 Firebase Cloud Firestore。

> **本版以「下拉選單選名字」辨識身分，不需要登入，屬於信任制。** 如果你希望用 Google 帳號驗證身分，請改用 [Google 登入版](https://github.com/Twilight-Strider/train-ticket-system_Google-login-version)。兩者的差異見[下方比較](#該用哪一個版本)。

---

## 目錄

- [該用哪一個版本](#該用哪一個版本)
- [功能與使用流程](#功能與使用流程)
- [運作原理](#運作原理)
- [技術架構](#技術架構)
- [建立你自己的版本](#建立你自己的版本)
- [CONFIG 設定參考](#config-設定參考)
- [管理與維運](#管理與維運)
- [安全性與隱私（請務必閱讀）](#安全性與隱私請務必閱讀)
- [已知限制](#已知限制)
- [疑難排解](#疑難排解)
- [專案結構](#專案結構)
- [回報錯誤與意見](#回報錯誤與意見)
- [開發說明](#開發說明)
- [讓 AI Agent 幫你部署](#讓-ai-agent-幫你部署)
- [第三方素材與商標聲明](#第三方素材與商標聲明)
- [授權](#授權)

---

## 該用哪一個版本

| | 選擇身份版（本 repo） | [Google 登入版](https://github.com/Twilight-Strider/train-ticket-system_Google-login-version) |
|---|---|---|
| 身分辨識 | 下拉選單選名字（信任制） | Google 登入 ＋ Email 白名單 |
| 使用的 Firebase 服務 | Cloud Firestore | Authentication ＋ Cloud Firestore |
| 設定難度 | 較低 | 較高（需啟用 Google 登入、設定授權網域與 CSP） |
| 資料保護 | **較弱**：知道網址的人可以冒用任何名字，且能讀取所有人的進度與截圖 | 較強：Firestore 規則依登入身分限制個人資料 |
| 適合 | 互相信任的小團體、短期使用 | 較在意誰能看到票券與截圖的情況 |

---

## 功能與使用流程

使用者開啟網頁後，依序經過下列步驟。進度會存在資料庫，**重新整理或換裝置後，只要選同一個名字並確認，就會回到上次的步驟**。

| 步驟 | 畫面 | 說明 |
|------|------|------|
| 0 | 選擇身份 | 從名單選擇自己的名字，再於確認視窗按「確認並進入」 |
| 1 | 安裝 App | 提供 Google Play / App Store 連結，安裝台鐵 e 訂通 |
| 2 | 去程選位 | 視覺化座位圖，點選座位後即時鎖定；下一頁顯示該座位的訂票代碼與取票驗證碼（可一鍵複製） |
| 3 | 返程選位 | 同上，針對返程車次 |
| 4 | 上傳截圖 | 上傳 App 取票完成的截圖作為確認；較大的圖片會自動壓縮 |
| 5 | 完成 | 內嵌顯示行程表 PDF（Google Drive），並提供下載按鈕 |

其他行為：

- **即時同步**：任何人選位，其他人的畫面立刻更新；已被他人選走的座位會變綠色，點擊會顯示「此座位已被 XXX 選取」。
- **搶位保護**：選位使用 Firestore Transaction，兩人同時選同一個座位時，只有一人會成功。
- **可換位**：同一個人改選另一個座位時，舊座位會自動釋放。
- **可返回修改**：在後面的步驟按「返回」回到前面的步驟修改座位，不會被強制跳回。

---

## 運作原理

### 資料模型（Cloud Firestore）

```
config/seats                      ← 全體共用的座位認領表
  outbound: { "12-34": "使用者 A", "12-36": "使用者 B", ... }
  return:   { "4-37":  "使用者 A", ... }

users/{名稱}                       ← 每位參與者一份；文件 ID = CONFIG.users 裡的名稱
  name, step, createdAt
  outboundSelection, returnSelection        例："12-34"
  screenshotBase64, screenshotName,
  screenshotOriginalSize, screenshotFinalSize, uploadedAt
```

- 座位識別碼的格式固定為 **`車廂號-座位號`**（例如 `12-34`），`CONFIG.*.tickets` 的 key 也必須使用同樣格式。
- 截圖以 **Base64 字串直接存在 Firestore 文件裡**（沒有使用 Firebase Storage），因此不需要額外開啟 Storage。
- `config/seats` 不存在時（第一次有人開啟），程式會自動建立；使用 Transaction 建立，因此不會蓋掉已經存在的資料。

### 身分模型

這個版本**沒有任何登入驗證**：名單來自 `CONFIG.users`，使用者在畫面上自己選名字。確認視窗上的「選擇後無法更改」只是提醒，**並不是技術上的限制**——任何人重新整理後都可以改選別人的名字。請把它當成「互相信任的朋友之間的協調工具」。

---

## 技術架構

| 技術 | 用途 |
|------|------|
| React 18（CDN, UMD） | 前端 UI |
| Babel Standalone | 在瀏覽器內即時編譯 JSX |
| Tailwind CSS（CDN） | 樣式 |
| Firebase JS SDK 9.22.0（compat）：App、Firestore | 即時資料庫 |
| Google Drive 預覽連結 | 行程表 PDF 顯示與下載 |

零建置、零伺服器：任何能提供靜態檔案的主機都能部署。（`index.html` 也載入了 Firebase App Check 的 SDK，但並沒有啟用，可以忽略。）

---

## 建立你自己的版本

整個流程大約 15～25 分鐘。你需要：一個 Google 帳號、Node.js（要使用檢查腳本與 Firebase CLI 時）、以及一個能放靜態檔案的主機（Firebase Hosting / Cloudflare Pages 皆可）。

> ⚠️ **開始前請先看[安全性與隱私](#安全性與隱私請務必閱讀)。** 票券代碼會寫在 `index.html` 裡，**填入真實資料後的檔案不要推到公開的 repo**，也不要把整個 fork 發布到公開網站。

### 步驟 1：取得程式碼

```bash
git clone https://github.com/Twilight-Strider/train-ticket-system.git
cd train-ticket-system
```

也可以直接在 GitHub 上 Fork，或下載 ZIP。**建議把填好真實資料的版本放在私人 repo 或只放在自己的電腦，不要提交到公開 repo。**

### 步驟 2：建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)，點「建立專案」。
2. 名稱自訂；Google Analytics 可以不啟用（本專案沒有使用）。

### 步驟 3：建立 Firestore 資料庫

1. **Build → Firestore Database → Create database**。
2. 選一個離使用者近的區域（台灣可選 `asia-east1`），模式選 **Production mode（正式版模式）**。
   **不要選測試模式**：測試模式的規則是對所有人開放讀寫，且有期限；下一步會改用專用的規則。

### 步驟 4：註冊 Web App 並取得設定

1. **專案設定（齒輪）→ 一般 → 你的應用程式 → `</>`（Web）**，註冊一個 Web App。
2. 複製畫面上的 `firebaseConfig`，下一步會貼進 `index.html`。
   （`measurementId` 只有啟用 Analytics 才會出現；本專案沒有使用，沒有也可以。）

### 步驟 5：編輯 `index.html` 的 `CONFIG`

打開 `index.html`，找到檔案上方標示「🔧 每次複製使用前，只需修改這個區塊」的 `CONFIG`，依 [CONFIG 設定參考](#config-設定參考) 填寫：參與者名單、去程／返程的車次資訊與座位圖、每個座位的訂票代碼與驗證碼、行程表 PDF 連結、Firebase 設定。

> 填寫時要小心逗號與引號：`CONFIG` 一旦有語法錯誤，整個頁面會是白畫面（見[疑難排解](#疑難排解)）。

### 步驟 6：檢查設定並產生 Firestore 規則

專案附了一個檢查腳本（只需要 Node.js，不需要安裝任何套件）：

```bash
node scripts/check-config.mjs index.html --write-rules firestore.rules
```

它會檢查：座位與票券是否一一對應、座位是否重複、名稱是否重複或含有不能當 Firestore 文件 ID 的字元、座位數是否夠人數、哪些欄位還是預留值；沒有錯誤時，依 `CONFIG.users` **產生對應的 `firestore.rules`**。

接著把規則發布到 Firebase，二選一：

- **Console**：Firestore Database → **Rules** 分頁 → 貼上 `firestore.rules` 的內容 → **發布**。
- **CLI**：見[步驟 9](#步驟-9部署)的 `firebase deploy --only firestore:rules`。

產生的規則長這樣（範例名單為「使用者 A～E」，**你的名單會不同**）：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 白名單：必須與 index.html 的 CONFIG.users 完全一致
    // （此檔由 scripts/check-config.mjs 依 CONFIG.users 產生；名單變動後請重新產生並發布）
    function isValidUser(name) {
      return name in ["使用者 A", "使用者 B", "使用者 C", "使用者 D", "使用者 E"];
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
```

> **規則說明**
> - `isValidUser`：只有名單內的名稱可以建立／修改自己的 `users/{名稱}` 文件；不在名單內的名稱一律拒絕。**這只是名稱檢查，不是身分驗證**（見[身分模型](#身分模型)）。
> - 讀取採開放（`read: if true`）：前端需要讀取座位表與自己的進度；**這也代表任何知道專案設定的人都能讀到所有人的進度與截圖**。
> - `config/seats` 採開放讀寫：座位認領本身沒有敏感資料，第一位使用者也需要能建立它；但這也代表任何人都能改動座位表。
> - 兩者都**禁止刪除**；需要重置時請在 Console 操作（Console 不受規則限制）。
> - 截圖字串限制在 1,000,000 字元以內：Firestore 單一文件上限是 1 MiB，這是在規則層對直接呼叫 API 的第二道把關（前端本身會壓縮到約 700,000 字元以內）。
> - **名單有變動時（加人、換名），請重新產生並發布規則**，否則新名稱會因 `Missing or insufficient permissions` 無法使用。

### 步驟 7：準備圖片

程式會讀取三張圖片，請放在與 `index.html` 同層的 `images/` 資料夾：

| 檔案 | 用在哪裡 |
|------|----------|
| `images/Google_Play.png` | 步驟 1 的 Google Play 連結圖 |
| `images/App_Store.png` | 步驟 1 的 App Store 連結圖 |
| `images/upload_info.jpg` | 步驟 4「上傳說明」彈窗裡的說明圖 |

商店徽章請從 [Google Play 品牌資源](https://partnerdash.google.com/apps/brand-resources)、[Apple Marketing Resources](https://developer.apple.com/app-store/marketing/guidelines/) 取得並遵守其使用規範。圖片也可以改放在 Cloudflare R2 等 CDN，把程式中對應的 `src` 換成完整網址即可（目前 CSP 的 `img-src` 已允許任何 `https:`）。

另外，步驟 2、3 的「App 取票教學」圖目前是**直接引用第三方網站的圖片網址**（`index.html` 中的 `helpImageUrl`），對方網站若更動或移除圖片，教學圖就會消失；`images/upload_info.jpg` 也不一定是你自己製作的素材。建議兩者都換成你自己製作的圖片，原因見[第三方素材與商標聲明](#第三方素材與商標聲明)。

### 步驟 8：本機測試

建議用本機伺服器測試（與正式部署時的行為最接近）：

```bash
python3 -m http.server 8000
# 瀏覽器開啟 http://localhost:8000
```

> 開著瀏覽器的開發者工具時，頁面會每秒被暫停一次——這是 `index.html` 內建的「干擾除錯」程式碼（見[安全性與隱私](#安全性與隱私請務必閱讀)）。要除錯的話，請先刪掉 `index.html` 中標示「干擾除錯 (Anti-Debugging)」的那段 `<script>`。

### 步驟 9：部署

任選一種靜態主機。

**Firebase Hosting（建議，與資料庫在同一個專案）**

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # 選擇你的專案
```

在專案根目錄建立 `firebase.json`：

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

然後：

```bash
firebase deploy --only firestore:rules,hosting
```

**Cloudflare Pages / GitHub Pages**：照平台指示發布。⚠️ **GitHub Pages 需要把檔案放在 repo 裡，若是公開 repo，票券資料等於公開**——請參考[安全性與隱私](#安全性與隱私請務必閱讀)。

### 部署後驗收清單

- [ ] 選擇一個名字並進入，能看到安裝 App 頁面。
- [ ] 用兩個瀏覽器（或兩台裝置）同時點同一個座位，只有一個人成功，另一人收到「此座位已被 XXX 選取」。
- [ ] 選位後，另一個瀏覽器的畫面即時看到該座位變綠色。
- [ ] 改選另一個座位後，舊座位恢復為可選。
- [ ] 去程與返程的訂票代碼與驗證碼和你填的一致（若顯示「未設定」，代表 `tickets` 的 key 與座位 `車廂號-座位號` 對不上）。
- [ ] 上傳一張大於 1 MB 的截圖，能成功並進入完成頁（確認自動壓縮正常）。
- [ ] 重新整理頁面、選同一個名字並確認，會回到上次的步驟。
- [ ] 行程表 PDF 可預覽與下載。
- [ ] **規則測試**：下面兩個請求都應該回傳 `403`。

  ```bash
  # 1) 不在名單內的名稱不得寫入
  curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H "Content-Type: application/json" -d '{"fields":{}}' \
    "https://firestore.googleapis.com/v1/projects/<專案ID>/databases/(default)/documents/users/not-in-the-list?key=<apiKey>"

  # 2) 座位表不得被刪除
  curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
    "https://firestore.googleapis.com/v1/projects/<專案ID>/databases/(default)/documents/config/seats?key=<apiKey>"
  ```

---

## CONFIG 設定參考

### 1. `users` — 參與者名單

```javascript
users: [
    "小明",
    "小華",
    "小美",
],
```

- 每個字串是一位參與者的顯示名稱，會出現在下拉選單。
- 名稱同時是 Firestore 的**文件 ID**：**不可重複、不可包含 `/`、不可是 `.` 或 `..`、不可是 `__xxx__` 格式、不要含雙引號或反斜線**。`scripts/check-config.mjs` 會替你檢查。
- 修改名單後，**記得重新產生並發布 Firestore 規則**。

### 2. `outbound` / `return` — 去程與返程

```javascript
outbound: {
    info: ["車次：自強 XXX", "車型：EMU3000", "乘車時間：09:00 - 11:30"],  // 顯示在選位頁左上角

    seats: [
        {
            id: 'row1',
            left:  [{ isGhost: true },       { no: '40', car: '12' }],
            right: [{ no: '39', car: '12' }, { no: '37', car: '12' }],
        },
        {
            id: 'row2',
            left:  [{ no: '34', car: '12' }, { no: '36', car: '12' }],
            right: [null, null],
        },
    ],

    tickets: {
        "12-34": { code: "訂票代碼", verify: "取票驗證碼" },
        "12-36": { code: "訂票代碼", verify: "取票驗證碼" },
        // ……每個實際座位一筆
    },
},
```

座位圖每一列有左側 2 格、右側 2 格，每一格可以是：

| 值 | 意義 |
|----|------|
| `{ no: '座位號', car: '車廂號' }` | 實際座位，可點選 |
| `{ isGhost: true }` | 空白佔位框（用來在視覺上補齊排列） |
| `null` | 完全空白（沒有座位） |

規則：

- 每個實際座位在 `tickets` 裡必須有一筆，key 為 `車廂號-座位號`（兩邊的字串要完全一致，包含前導零）。
- `return`（返程）的格式與 `outbound` 完全相同。
- 座位數至少要等於參與者人數，否則會有人選不到。

### 3. `schedule` — 行程表 PDF

```javascript
schedule: {
    pdfUrl:      "https://drive.google.com/file/d/<檔案ID>/preview",
    downloadUrl: "https://drive.google.com/u/0/uc?id=<檔案ID>&export=download",
},
```

把 PDF 上傳到 Google Drive，共用設定改為「知道連結的任何人可檢視」，再把檔案 ID 填入兩個連結。

### 4. `firebase` — 步驟 4 取得的設定

`apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId`（`measurementId` 選填）。

---

## 管理與維運

- **查看誰選了哪個座位**：Console → Firestore → `config/seats`。
- **重置全部座位**：在 Console 刪除 `config/seats` 整份文件（規則禁止從前端刪除，Console 不受限）；第一次有人開啟頁面時會自動重建。
- **重置某人的進度**：在 Console 刪除 `users/{名稱}` 文件；如果也要釋放他佔用的座位，請同時到 `config/seats` 移除對應的欄位。
- **檢視截圖**：`users/{名稱}.screenshotBase64` 已經是完整的 `data:image/jpeg;base64,…` 字串，可貼到瀏覽器網址列檢視。
- **加人／換人**：修改 `CONFIG.users` → 重新執行 `node scripts/check-config.mjs index.html --write-rules firestore.rules` → 重新發布規則 → 重新部署網站。
- **下一次活動**：資料模型沒有「活動」的概念，請建立新的 Firebase 專案，或先清空 `users` 集合與 `config/seats`。
- **活動結束後**：請刪除 `users` 集合與 `config/seats`，並下架網站、停用或刪除整個 Firebase 專案。

---

## 安全性與隱私（請務必閱讀）

這個專案是為「一小群互相認識的人、短期使用」設計的，**不是**高安全等級的系統。請了解以下事實：

1. **沒有身分驗證。** 任何打開網址的人都可以選擇名單上任何一個名字，並以那個人的身分繼續操作。「選擇後無法更改」只是畫面提醒。
2. **票券代碼寫在前端檔案裡。** 訂票代碼與取票驗證碼放在 `index.html` 的 `CONFIG.*.tickets`，**任何能打開你部署網址的人，都可以用「檢視原始碼」看到全部票券資料**，不需要選名字。
   - 請**不要把填入真實票券資料的 `index.html` 推到公開的 repo**，也不要把含真實資料的 fork 發布到公開網站。
   - 部署網址只分享給參與者；活動結束後立刻下架。
   - 需要更高保護時，可以考慮放在有存取控制的主機（例如 Cloudflare Access），或改用[Google 登入版](https://github.com/Twilight-Strider/train-ticket-system_Google-login-version)。
3. **所有人的進度與截圖都是公開可讀的。** Firestore 規則為了讓前端運作而允許任何人讀取 `users` 與 `config/seats`；任何看過你網頁原始碼的人，都能取得 Firebase 設定並直接讀取這些資料。截圖含有購票資訊，請提醒參與者**不要上傳含有身分證字號等個資的畫面**，並在活動結束後刪除資料。
4. **Firebase `apiKey` 不是機密**（Firebase 官方文件如此說明），可以存在前端；真正的防護來自 Firestore 規則，所以**規則一定要上線**，不要使用「測試模式」。
5. **前端的「防止篡改」只是嚇阻，不是安全機制。** 頁面包含凍結 `console`／`JSON`、定時 `debugger` 的干擾除錯程式碼，懂的人可以輕易繞過；它也會讓開發者工具一開就被中斷。開發階段可以自行移除那兩段 `<script>`。

---

## 已知限制

- **截圖有大小處理。** 截圖以 Base64 存在 Firestore，單一文件上限為 1 MiB。程式在原檔超過 500 KB 時會自動壓縮成 JPEG（長邊最多 1920 px，必要時再縮小尺寸），把結果控制在約 700,000 字元以內；若仍壓不下來（極端大圖）會提示更換圖片。上限數值定義在 `Step4_Upload` 的 `MAX_BASE64_CHARS` 與 `NO_COMPRESS_BYTES`，改動時請同步檢查 Firestore 規則裡的 1,000,000 字元限制。
- 只支援兩段行程（去程＋返程），且每列固定為「左 2 格＋右 2 格」的座位配置。
- 一個人在去程與返程各只能選一個座位。
- 沒有「活動」的概念；重複使用同一個專案前需要先清空資料（見[管理與維運](#管理與維運)）。
- React／Babel 以 CDN 載入並在瀏覽器內即時編譯，首次載入較慢，且 CSP 需要允許 `unsafe-eval`；瀏覽器若無法連到這些 CDN，頁面會是白畫面。
- 步驟進度記在「名稱」上，不是記在裝置上：換裝置時，選同一個名字並確認即可接續。

---

## 疑難排解

| 現象 | 可能原因與解法 |
|------|----------------|
| **白畫面** | 1) `CONFIG` 或其他程式碼有語法錯誤（少逗號、引號、括號）：打開瀏覽器的 Console，會看到 `Unexpected token`；2) 瀏覽器連不到 CDN（unpkg、gstatic、Tailwind）：檢查網路或是否被擋；3) 開著開發者工具時頁面被 `debugger` 暫停（見步驟 8） |
| 主控台出現 `Missing or insufficient permissions` | Firestore 規則的 `isValidUser` 名單與 `CONFIG.users` 不一致，或規則尚未發布：重新執行檢查腳本、重新產生並發布規則 |
| 選位後畫面沒有即時更新 | 檢查 `firebase` 設定是否填對；檢查 `config/seats` 的讀取規則是否已發布 |
| 票券顯示「未設定」 | `tickets` 的 key 與座位的 `車廂號-座位號` 不一致（可用檢查腳本找出） |
| 座位顯示「已被某某選取」但那個人其實不需要了 | 到 Console 的 `config/seats` 刪除該座位的欄位，或請對方改選別的座位 |
| 上傳截圖失敗 | 網路中斷，或圖片極端大壓不下來（見[已知限制](#已知限制)），換一張較小的截圖 |
| 圖片破圖 | `images/` 資料夾缺檔，或沒有一起部署 |
| 行程表 PDF 打不開 | Drive 檔案沒有開放「知道連結的任何人可檢視」，或連結中的檔案 ID 錯誤 |

---

## 專案結構

```
.
├── index.html              # 主程式（單一檔案，設定都在上方的 CONFIG）
├── images/
│   ├── Google_Play.png
│   ├── App_Store.png
│   └── upload_info.jpg
├── scripts/
│   └── check-config.mjs    # 檢查 CONFIG、產生 Firestore 規則
├── .github/
│   └── ISSUE_TEMPLATE/     # 回報錯誤的 Issue 表單
├── AGENTS.md               # 給 AI Agent 的自動部署說明
├── LICENSE
├── README.md
└── SECURITY.md             # 資安問題的回報方式
```

---

## 回報錯誤與意見

遇到問題、找到 bug 或有建議，歡迎回報：

- **一般問題（建議）**：到 [GitHub Issues](https://github.com/Twilight-Strider/train-ticket-system/issues/new/choose) 開一個新的 Issue，頁面上有表單可以照著填。
- **不想公開、或內容涉及隱私**：寄信到 **bug-report-ticket-select@1090033.fyi**，信件會轉寄給維護者。
- **疑似資安問題**：請**不要**開公開 Issue，請見 [`SECURITY.md`](SECURITY.md)。

回報時請盡量附上：使用的裝置與瀏覽器（含版本）、重現步驟、你預期的結果與實際發生的結果，以及瀏覽器主控台（按 F12 → Console）裡的紅色錯誤訊息。

> ⚠️ **請不要在公開的 Issue 貼出**訂票代碼、取票驗證碼、含個人資訊的截圖或你的 Email。需要提供時請遮蔽，或改用寄信的方式。

---

## 開發說明

本專案為 **Vibe Coding** 協同開發專案，由以下 AI 工具協力完成：

- **[Gemini Canvas](https://gemini.google.com/)** — 互動式 UI 設計與原型迭代
- **[Claude AI on Perplexity](https://www.perplexity.ai/)** — 邏輯架構設計、程式碼審查與除錯
- **[Claude](https://www.anthropic.com/claude)（Anthropic）** — 2026 年 11 月以 Claude Code 協助程式碼審查與修正、重寫本 README、撰寫 `AGENTS.md` 與 `scripts/check-config.mjs`、建立 Issue 表單

專案由 [Twilight-Strider](https://github.com/Twilight-Strider) 維護。

---

## 讓 AI Agent 幫你部署

如果你使用 Claude Code、Codex 等能操作終端機的 AI Agent，可以請它先閱讀 [`AGENTS.md`](AGENTS.md)，它會說明需要向你蒐集哪些資訊、哪些步驟必須由你親自在瀏覽器完成（例如登入 Google 帳號），以及如何驗收。

---

## 第三方素材與商標聲明

- 本專案與台灣鐵路公司（臺鐵）、Google、Apple **沒有任何關聯**。「台鐵 e 訂通」、Google Play、App Store 等名稱與標誌為其各自所有者的商標或著作。
- MIT 授權只涵蓋本 repo 中**本專案自己的程式碼與文件**。商店徽章圖片、App 截圖、以及程式中引用的第三方圖片（例如 `helpImageUrl` 所指向的外部教學圖）**不在授權範圍內**，其著作權屬於原作者；散布自己的版本前，請替換成你自己製作或有權使用的素材。
- 程式使用的開源函式庫以 CDN 方式載入、不隨本 repo 散布：React（MIT）、Babel（MIT）、Tailwind CSS（MIT）、Firebase JS SDK（Apache-2.0）。

---

## 授權

本專案以 [MIT License](LICENSE) 釋出，你可以自由使用、修改、散布，包含商業用途，只需保留版權與授權聲明。軟體依「現狀」提供，不附任何擔保。
