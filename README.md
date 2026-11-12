# askHedy 🌸

HEDY 是住在你 iPhone 裡的小女孩 AI 助理。她可以連結你的 **Gmail、Google 日曆、Google Drive**，幫你讀信、摘要、草擬與寄出回覆、安排行程、找檔案與整理文件。

- 📱 iOS 介面（Expo / React Native），淺色主題
- 🔐 Google 官方 OAuth（PKCE），token 只存在手機的 Secure Store
- 🤖 可接 **OpenRouter、OpenAI、Claude (Anthropic)、Groq、DeepSeek** 或任何 OpenAI 相容端點（Ollama、LM Studio、One API…）
- 🛡️ 寄信、建立行程、刪檔等會改變外部狀態的動作都先跳「確認卡片」
- 🧠 長期記憶：Hedy 會記住你的偏好，可在設定裡檢視與刪除

---

## 目錄結構

```
src/
  app/                    Expo Router 畫面
    (tabs)/index.tsx      Hedy 對話（agent 主畫面）
    (tabs)/inbox.tsx      信箱
    (tabs)/calendar.tsx   行事曆
    (tabs)/drive.tsx      雲端硬碟
    (tabs)/settings.tsx   設定（Google 授權、AI 模型、記憶）
    mail/[id].tsx         信件內容
    compose.tsx           撰寫 / 回覆郵件
    provider.tsx          新增 / 編輯 AI 供應商
    event-new.tsx         手動新增行程
    conversations.tsx     對話紀錄
    memory.tsx            Hedy 的記憶
  lib/
    google/auth.ts        OAuth、token 儲存與自動 refresh
    google/gmail.ts       Gmail API（列表、讀取、寄送、回覆、草稿、標記）
    google/calendar.ts    Calendar API（查詢、建立、修改、刪除）
    google/drive.ts       Drive API（搜尋、讀取、建立、搬移、改名、刪除）
    llm/                  供應商抽象層（OpenAI 相容 + Anthropic Messages API）
    agent/tools.ts        給模型用的工具定義與執行器
    agent/agent.ts        工具迴圈（含審核）
    agent/prompt.ts       HEDY 人設 system prompt
  store/                  zustand 狀態（settings / google / chat）
  components/             UI 元件（HedyAvatar、MessageBubble、ApprovalCard…）
assets/hedy.svg           HEDY 原始向量圖；`npm run icons` 會重新產生所有圖示
```

---

## 1. 安裝

```bash
npm install
```

在電腦上預覽 UI（不含 Google 登入）：

```bash
npx expo start
```

用 iPhone 的 **Expo Go** 掃 QR code 即可看到所有畫面並設定 AI 模型、跟 Hedy 聊天。
也可以按 `w` 在電腦瀏覽器開啟網頁預覽（第一次打包在 Windows 上可能要等 1～5 分鐘，請看終端機的進度條跑完再重新整理）。網頁版只是方便看介面：API key 會存在瀏覽器 localStorage，Google 登入在網頁上不可用。
**Google 登入需要 development build（見第 3 步）**，因為 Expo Go 無法註冊 Google 要求的自訂 URL scheme。

---

## 2. 設定 Google OAuth

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立專案。
2. **API 和服務 → 程式庫**：啟用 **Gmail API、Google Calendar API、Google Drive API**。
3. **OAuth 同意畫面**：使用者類型選「外部」，發布狀態保持「測試中」，把你自己的 Gmail 加進 **測試使用者**（未經 Google 驗證的 app 只能給測試使用者用，個人使用這樣就夠了）。
   範圍加入：
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/drive`
4. **憑證 → 建立憑證 → OAuth 用戶端 ID**：
   - 應用程式類型：**iOS**
   - 軟體包 ID：`com.askhedy.app`（要跟 `app.json` 的 `ios.bundleIdentifier` 一致；想改名就兩邊一起改）
5. 複製 client id（長得像 `123456-abc.apps.googleusercontent.com`），填進 `app.json`：

```jsonc
{
  "expo": {
    "scheme": [
      "askhedy",
      "com.googleusercontent.apps.123456-abc"   // ← client id 反過來寫
    ],
    "extra": {
      "googleIosClientId": "123456-abc.apps.googleusercontent.com"
    }
  }
}
```

iOS 類型的用戶端不需要 client secret，app 用 PKCE 直接跟 Google 換 token，並拿到 refresh token 自動續期。

---

## 3. 在 Windows 上建置 iPhone App（EAS Build）

你不需要 Mac。Expo 的雲端建置會幫你編譯 iOS app：

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas build:configure
```

```bash
eas build --profile development --platform ios
```

- 第一次會請你登入 **Apple Developer 帳號**（需要 USD 99/年 的開發者方案，才能把 app 裝到實體 iPhone 上）並自動建立憑證、把你的 iPhone 註冊進 provisioning profile。
- 建置完成後用 iPhone 掃 EAS 給的 QR code 安裝。
- 之後改 JS 不用重建；執行 `npx expo start --dev-client`，用剛裝好的 app 連上即可。只有改 `app.json` 的 scheme / plugins 或新增原生套件時才需要重新 `eas build`。

要做一個不用連電腦的正式版：

```bash
eas build --profile preview --platform ios
```

---

## 4. 在 App 裡完成設定

1. **設定 → Google 帳號 → 連結 Google 帳號**，用你的測試使用者 Gmail 登入並同意權限。
2. **設定 → AI 模型 → 新增**：
   - 選供應商（OpenRouter / OpenAI / Claude / Groq / DeepSeek / 自訂）
   - 貼上 API key，按「從 API 取得模型列表」挑模型，再按「測試連線」
   - Claude 預設 `claude-opus-5-5`；OpenRouter 可用任何路由模型（例如 `anthropic/claude-opus-5.5`）
3. **設定 → 關於你**：填你的名字（Hedy 會這樣叫你，也用來署名信件）。
4. 回到 **Hedy** 分頁開始使用，例如：
   - 「幫我看今天有哪些未讀信，挑出需要回的」
   - 「回覆小美那封信，說我週四可以，語氣輕鬆一點」
   - 「明天下午三點跟阿強開會一小時，地點在公司」
   - 「找 Drive 裡上個月的報價單並摘要」

---

## 安全與隱私

- API key 與 Google token 存在 **expo-secure-store**（iOS Keychain）。
- 所有請求都從手機直接打到 Google 與你選的模型供應商，沒有中介伺服器。
- 寄信、回信、建立／修改／刪除行程、建立／搬移／刪除檔案都會先顯示確認卡片；可在設定裡關閉（不建議）。
- 模型會看到你的信件內容。如果用第三方路由器，請確認你信任該供應商的資料政策。

---

## 常用指令

```bash
npm run typecheck     # tsc --noEmit
npm run icons         # 從 assets/hedy.svg 重新產生所有圖示
npx expo-doctor       # 檢查相依套件與設定
```

## 已知限制 / 之後可以加的

- 回覆目前是純文字；尚未支援附件上傳與 HTML 信件編輯。
- 沒有背景輪詢（OpenMausBot 的 Gmail 事件觸發需要伺服器）；想要「有新信就通知」可加一個小型 server 或改用 iOS 背景抓取。
- 模型回覆目前不是串流（為了簡化工具迴圈）。
