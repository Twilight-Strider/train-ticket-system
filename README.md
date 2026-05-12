# 🎫 火車選位分票系統

一個用於團體購票後，讓成員自主認領座位並完成取票的協作工具。基於純前端 HTML 單頁應用，搭配 Firebase Firestore 實現即時同步。

---

## ✨ 功能特色

- 📋 **身份選擇**：登入頁面讓每位參與者確認自己的名字
- 🚆 **去程選位**：以視覺化座位圖方式認領去程車票
- 🔁 **返程選位**：同步返程車票選位
- 📸 **上傳截圖**：取票完成後上傳 App 截圖作為確認
- 📄 **行程表下載**：完成後顯示行程計畫表 PDF
- 🔄 **即時同步**：透過 Firebase Firestore 讓所有人即時看到座位認領狀態

---

## 🛠️ 技術架構

| 技術 | 用途 |
|------|------|
| React 18 (CDN UMD) | 前端 UI 框架 |
| Babel Standalone | JSX 即時編譯 |
| Tailwind CSS (CDN) | 樣式框架 |
| Firebase Firestore | 即時資料庫 |
| 單一 `index.html` | 零打包、零建置工具 |

---

## 🤖 開發說明

本專案為 **Vibe Coding** 協同開發專案，由以下 AI 工具協力完成：

- **[Gemini Canvas](https://gemini.google.com/)** — 用於互動式 UI 設計與原型迭代
- **[Claude AI on Perplexity](https://www.perplexity.ai/)** — 用於邏輯架構設計、程式碼審查與除錯

本專案展示了多個 AI 工具協同 Vibe Coding 的可能性，整個應用僅以一份 `index.html` 完成。

---

## 🚀 快速開始

### 1. 取得檔案

```bash
git clone https://github.com/YOUR_USERNAME/train-ticket-splitter.git
cd train-ticket-splitter
```

### 2. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案
3. 啟用 **Cloud Firestore**（測試模式或設定適當安全規則）
4. 在「專案設定」→「您的應用程式」取得 Web 設定

### 3. 設定 `index.html`

打開 `index.html`，找到頂部的 `CONFIG` 區塊，依序填入：

```javascript
const CONFIG = {

    // 1. 參與者名單
    users: ["小明", "小華", "小美"],

    // 2. 去程資訊
    outbound: {
        info: ["車次：自強 XXX", "車型：EMU 3000", "乘車時間：HH:MM - HH:MM"],
        seats: [ /* 依格式填入座位 */ ],
        tickets: {
            "車廂-座位": { code: "訂票代碼", verify: "驗證碼" },
        },
    },

    // 3. 返程資訊（同上格式）
    return: { ... },

    // 4. 行程表 PDF（Google Drive）
    schedule: {
        pdfUrl: "https://drive.google.com/file/d/YOUR_FILE_ID/preview",
        downloadUrl: "https://drive.google.com/u/0/uc?id=YOUR_FILE_ID&export=download",
    },

    // 5. Firebase 設定
    firebase: {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID",
    },
};
```

### 4. 準備圖片素材

專案使用以下圖片，請自行準備：

| 檔案 | 說明 |
|------|------|
| `images/upload_info.jpg` | 上傳截圖步驟的說明圖 |

**選項 A：本地部署**
在與 `index.html` 同層建立 `images/` 資料夾，放入對應圖片。

**選項 B：使用 Cloudflare R2 或其他 CDN**
將圖片上傳至 R2 bucket，然後將 `index.html` 中對應的 `src` 改為完整 URL：
```html
<!-- 找到這一行並替換 src -->
src="https://pub-xxxxxxxxxxxx.r2.dev/upload_info.jpg"
```

### 5. 部署

由於是純靜態 HTML，可部署至任何靜態主機：

- **GitHub Pages**：推送後在 Settings → Pages 開啟
- **Cloudflare Pages**：連接 repo 後自動部署
- **直接開啟**：本地用瀏覽器直接開啟 `index.html`（Firebase 連線仍需網路）

---

## 📁 專案結構

```
.
├── index.html          # 主程式（單一檔案）
├── images/
│   └── upload_info.jpg # 上傳說明圖（請自行準備）
└── README.md
```

---

## 🔒 安全注意事項

- **不要**將含有真實票券代碼、Firebase 金鑰的 `index.html` 推送至公開 repo
- Firebase API Key 雖可公開，但請務必在 Firebase Console 設定適當的**安全規則**與**已授權網域**
- 建議使用完成後刪除或清空 Firestore 中的使用者資料

### Firestore 安全規則

在 Firebase Console → Firestore → 規則 中貼入以下設定，並將白名單中的名稱替換為你的實際參與者名單：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. 白名單定義：只有名單內的使用者可以寫入
    function isValidUser(name) {
      return name in ["使用者 A", "使用者 B", "使用者 C", "使用者 D", "使用者 E", "使用者 F"];
    }

    // 2. 座位表規則 (config/seats)
    match /config/seats {
      // 讀取：所有人可讀（讓所有人看到即時座位狀態）
      allow read: if true;

      // 建立與修改：開放（第一位進入者建立、後續人修改皆可）
      allow create, update: if true;

      // 刪除：嚴格禁止（防止整個座位表被清空）
      allow delete: if false;
    }

    // 3. 用戶資料規則 (users/{userId})
    match /users/{userId} {
      // 讀取：所有人可讀
      allow read: if true;

      // 寫入：白名單內的使用者才可操作
      // 上傳截圖時限制 base64 大小 < 2MB（約 1.5MB 原始圖片）
      allow write: if isValidUser(userId)
                   && (!("screenshotBase64" in request.resource.data)
                       || request.resource.data.screenshotBase64.size() < 2000000);
    }
  }
}
```

> **規則說明**
> - 座位表採寬鬆寫入（`create, update: if true`）是為了讓第一位使用者能初始化文件，且座位認領本身沒有敏感資料
> - 用戶資料寫入透過白名單保護，防止任意人員寫入資料庫
> - 截圖大小限制在規則層做雙重把關（前端已有壓縮，這裡防止繞過前端的直接 API 呼叫）

---

## 📝 座位格式說明

`seats` 陣列中每個 row 的格式：

```javascript
{
    id: 'row1',
    left:  [{ no: '座位號', car: '車廂號' }, { isGhost: true }],
    //        實際座位                          空白佔位（補齊用）
    right: [{ no: '座位號', car: '車廂號' }, null],
    //                                          null = 此格無座位
}
```

---

## 📄 License

MIT License — 歡迎自由使用、修改與分發。
