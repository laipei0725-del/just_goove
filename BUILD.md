# JUST GROOVE — iOS 建置、IPA 與部署

本專案使用 Expo SDK 57、React Native 0.86，支援 iPhone 與 iPad。相機與影片播放請優先以實機驗證；iOS 模擬器沒有可用的相機預覽。

## 1. 環境需求

- Node.js 20 LTS（建議使用目前 Expo SDK 57 支援的版本）
- macOS + 最新穩定版 Xcode（本機 iOS build 時需要）
- Apple Developer Program 會員資格（真機簽章、TestFlight、App Store）
- Expo 帳號與 EAS CLI

```bash
npm install --global eas-cli
eas login
```

## 2. 從零建立同等專案（規格要求指令）

目前 repository 已經建立完成，無須再次執行；以下供全新環境參考：

```bash
npx create-expo-app@latest just-groove-app
cd just-groove-app
npx expo install react-native-webview react-native-svg expo-camera expo-keep-awake expo-image-picker expo-video expo-screen-orientation @react-native-community/slider
npm install react-native-youtube-iframe
npx expo start
```

請使用 `npx expo install` 安裝 Expo／原生模組，讓版本自動對齊 SDK 57。

## 3. 本地開發與檢查

```bash
npm install
npx expo install --check
npx expo-doctor
npx expo start
```

按 `i` 啟動 iOS 模擬器，或以 Expo Go 掃描 QR code。WebView、YouTube、相簿與 UI 可在模擬器測試；Camera Overlay 必須用實機。若變更 `app.json` plugins 或任何原生套件，需要重新 build，不只重新載入 JavaScript。

完整原生開發版：

```bash
npx expo install expo-dev-client
npx expo run:ios
```

指定實機：

```bash
npx expo run:ios --device
```

## 4. EAS 初始化

`app.json` 的 iOS Bundle ID 目前為 `com.peipei.justgroove`。正式發布前確認此 ID 在 Apple Developer 與 App Store Connect 中唯一且正確。

```bash
eas whoami
eas build:configure
eas credentials --platform ios
```

首次執行時，EAS 會要求建立或選擇 Apple Distribution Certificate 與 Provisioning Profile。不要將憑證、`.p12`、密碼或 App Store Connect API key 提交到 Git。

## 5. 產出 IPA

### 已註冊真機的內部測試 IPA

```bash
eas device:create
eas build --platform ios --profile preview
```

`preview` 使用 internal distribution，會產出簽署過、可安裝到 provisioning profile 內已註冊裝置的 `.ipa`。新增裝置後必須重新 build。

### iOS Simulator build（不是 IPA、不可裝真機）

```bash
eas build --platform ios --profile simulator
```

### App Store／TestFlight 正式 IPA

```bash
eas build --platform ios --profile production
```

本機產出 production IPA（需要 macOS、Xcode、Fastlane 與有效簽章）：

```bash
eas build --platform ios --profile production --local
```

EAS local build 預設會在目前目錄輸出 artifact；可用 `EAS_LOCAL_BUILD_ARTIFACTS_DIR` 指定輸出資料夾。

## 6. TestFlight 與 App Store Connect

先在 App Store Connect 建立 App record，Bundle ID 必須與 `app.json` 相同。完成 production build 後：

```bash
eas submit --platform ios --profile production
```

也可一次 build 並送出：

```bash
eas build --platform ios --profile production --auto-submit
```

上傳完成後等待 Apple 處理，再於 TestFlight 設定內部／外部測試群組。正式上架前需要補齊 App Privacy、相機與相簿資料用途、年齡分級、截圖、支援網址及審查說明。Instagram／YouTube 嵌入內容的網路播放行為也應在審查備註中說明。

## 7. 發布前實機驗收

- iPhone SE、一般尺寸、Pro Max 與 iPad 直／橫向佈局
- YouTube URL、Shorts URL、Instagram Reel／Post、私人或需登入內容的失敗提示
- 本機影片播放、0.1x–2.0x、長按調速、鏡像、拖曳進度、AB loop
- 前鏡頭權限拒絕／允許、20%–100% 透明度
- 全螢幕進出與旋轉、Safe Area、來電或切到背景後恢復
- 螢幕常亮只在練習頁生效
- 分享面板、刪除帳號雙重確認、VoiceOver 標籤與 44pt 觸控區

## 8. 常見問題

- Instagram 官方嵌入可能因私人帳號、登入、地區、CSP 或平台政策失敗；App 不應爬取或繞過限制，請引導使用者從照片圖庫匯入其有權使用的影片。
- YouTube iframe 僅接受播放器支援的速率，本 App 會將 0.1x 操作對齊可用級距。
- 修改權限文字、相機 plugin 或原生依賴後，Expo Go 的熱更新不足以驗證，必須重新建立 development／preview build。

官方參考：Expo SDK 57 Camera、ImagePicker、Video、KeepAwake 文件，以及 EAS iOS build／submit 文件。
