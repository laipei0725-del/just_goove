# JUST GROOVE｜練舞鏡 App 規格書

參考對象：SyncMirror Player（鏡像練舞 App），並加入「AB 循環模式」為核心功能。
本文件 + 附上的 `index.html`（可直接用瀏覽器打開測試的網頁原型）可直接交給 Antigravity 或其他開發代理，據此建置正式 iOS / Android App。

---

## 1. App 基本資訊

| 項目 | 內容 |
|---|---|
| App 名稱 | JUST GROOVE |
| 平台 | iOS、Android |
| 一句話描述 | 舞蹈練習工具，支援鏡向播放、變速、AB 段落循環、錄影對比，並可用語音或文字下指令，介面可愛好上手。 |
| 已附原型 | `index.html`（網頁版可互動原型，功能邏輯已可運作，供開發時對照） |

---

## 2. 功能清單

| 功能 | 說明 | 輸入 | 輸出 |
|---|---|---|---|
| MirrorMode 鏡像模式 | 影片左右翻轉，像鏡子一樣練舞 | imported_video | mirrored_video |
| SpeedControl 變速播放 | 播放速度 0.25x ~ 1.5x 可調 | imported_video, speed_factor | adjusted_video |
| VideoImport 影片匯入 | 從本機相簿匯入影片 | device_storage | imported_video |
| IGVideoImport IG 影片匯入 | 見下方「重要限制」說明 | IG_link_or_account | imported_video |
| **ABLoop AB 循環模式** | 設定 A、B 兩個時間點，於區間內無限循環播放，方便反覆練同一段 | imported_video, point_A, point_B | looped_video |
| CompareRecording 錄影對比 | 開鏡頭錄下自己動作，與教學影片並排（左右）比對播放 | imported_video, camera_recording | comparison_video |
| BrightnessControl 亮度調整 | 調整影片亮度，看清楚動作細節 | imported_video, brightness_level | brightness_adjusted_video |
| **FullScreenMode 全螢幕播放** | 支援橫向/直向全螢幕播放，練舞時更專注 | imported_video, comparison_video | fullscreen_video |
| VoiceCommand 語音指令 | 語音操作播放/暫停/變速/循環等 | microphone_input | app_action |
| TextCommand 文字指令 | 文字輸入操作同上功能 | text_input | app_action |

## 2.1 打包安裝需求（非網頁版）

| 平台 | 格式 | 發布/安裝方式 |
|---|---|---|
| iOS | `.ipa` | TestFlight 或 Ad Hoc 側載安裝 |
| Android | `.apk` | 直接下載 apk 安裝 |

已提供對應的原生 Expo (React Native) 專案原始碼於 `just-groove-app/` 資料夾，內含完整建置步驟（見該資料夾內 `BUILD.md`），可在有網路與 Node.js 的環境（例如 Antigravity）執行 `eas build` 直接產出 ipa / apk。此原型/專案只需在具備網路與建置工具的環境執行一次建置指令，之後即為可離線安裝使用的手機 App，非僅限瀏覽器開啟的網頁版。

### 語音／文字指令對應表（原型已實作邏輯）
- 播放 / play → 開始播放
- 暫停 / pause / 停 → 暫停
- 加速 / 快 → 播放速度 +0.25x（上限 1.5x）
- 減速 / 慢 → 播放速度 −0.25x（下限 0.25x）
- 鏡像 / mirror → 切換鏡像模式
- 循環 / loop → 切換 AB 循環開關

---

## 3. UI 設計方向（v2：黑色系・日系時尚・專業質感）

- 主色調：背景 `#0D0D0D`（近純黑）、卡片 `#1B1B1B`、卡片邊框 `#262626`
- 主色：萊姆綠 `#C8FF35`（數值、啟用狀態、重點文字）
- 輔色：紫色 `#8B5CF6`（播放鍵、主要操作按鈕）
- 文字：主文字 `#F4F4F2`（近白）、次要文字 `#9A9A96`
- 字體：標題用 Zen Kaku Gothic New（日系俐落黑體，取代原本可愛圓體，呈現專業質感）、內文用 Noto Sans TC、數值用 JetBrains Mono
- 卡片圓角統一 24px，深色卡片＋細邊框取代陰影堆疊，質感更沉穩
- **速度微調**：拿掉滑桿/選擇框，改成「－ / ＋」兩顆按鈕，每次點擊調整 0.1x，長按可連續調整（範圍 0.1x ~ 2.0x），數值置中以大字級顯示

## 3.1 Phase 2 路線圖（尚未建置，源自妳提供的兩份完整 App 規格）

妳後續貼的「Dance Practice Player / Dance Practice Pro」規格，其實描述的是一個規模更大的完整 App，包含：

- 5 個分頁：首頁 / 練習 / 影片庫 / 進度 / 設定
- 首頁：問候語、今日練習時間、連續天數、每週目標、最近/最愛影片、快速動作
- 練習頁：時間軸標記（Marker，如 Intro / Verse / Combo）、多組可命名/上色的 Loop、前鏡頭疊加預覽（可調透明度/大小/位置）、節拍器（60-160 BPM）、Count-in（4/8拍、語音/嗶聲）、播放計時器自動停止（15/30/45/60分）
- 影片庫：資料夾分類、收藏、搜尋/篩選/排序、縮圖網格、影片詳情（標籤、練習次數、筆記）
- 進度頁：練習時數圖表（日/週/月）、連續天數、成就徽章
- 設定頁：主題、語言、雲端備份、匯出/匯入資料
- iPad 分割版面、鍵盤快捷鍵、手勢操作（滑動切影片、長按建 Loop、雙擊建標記、雙指縮放）

這個量體大約是目前專案的 3-5 倍工作量，建議分階段做。若要繼續，下一步我可以先做：
1. 五分頁的導航骨架（Home / Practice / Library / Progress / Settings）
2. 練習頁的 Loop 多段管理 + Marker 標記
3. 節拍器與 Count-in

跟我確認想先做哪一塊，我再繼續往下建置。

---

## 4. ⚠️ 重要限制：IG 影片匯入

Instagram 並未開放「輸入連結或帳號即可直接下載他人影片」的公開 API；未經授權抓取/下載 IG 影片會違反 Instagram 服務條款，也可能涉及著作權問題。

**建議做法（原型已採用）：**
使用者自行在 IG 內用「分享 → 儲存影片」把影片存到手機相簿，再透過 App 的「從相簿匯入」功能匯入練習。App 本身不做任何自動抓取/下載 IG 內容的行為。

## 3.2 新增功能（v3）

- **全螢幕懸浮編輯列**：進入全螢幕後，畫面下方會浮出一條半透明控制列，包含「－ / ＋」速度微調按鈕與可拖曳的進度條，不需離開全螢幕就能微調速度、快速預覽段落。
- **右側懸浮按鈕**：影片畫面右側改為垂直懸浮按鈕群（耳機／分享／相機／全螢幕），全螢幕按鈕固定在最下方。
- **時間軸／進度條**：主畫面新增可拖曳的進度條，左側顯示目前時間，右側顯示剩餘時間，本機影片與 YouTube 匯入皆適用。
- **YouTube 連結匯入（鏡面預覽）**：貼上 YouTube 連結後，App 會建立官方 YouTube 嵌入播放器並對其做視覺鏡面翻轉；播放/暫停/AB循環都透過 YouTube 官方 IFrame API 控制。**不會下載或修改原始影片檔案**，避免違反 YouTube 服務條款與版權問題。速度只能在 YouTube 支援的固定倍率間切換（0.25/0.5/0.75/1/1.25/1.5/1.75/2x），無法像本機影片一樣做 0.1x 連續微調，這是 YouTube 官方 API 的限制。
- **Safe-area 適配 / 系統手勢優化**：套用 `env(safe-area-inset-top)`／`env(safe-area-inset-bottom)`，避免瀏海/導航列遮擋；按鈕與版面關閉長按選單彈出（`-webkit-touch-callout:none`）與文字選取（`user-select:none`），文字輸入框仍保留正常選取/貼上功能；全域關閉過度捲動回彈（`overscroll-behavior:none`）。
- **設定頁／刪除帳號**：新增「設定」卡片與「刪除帳號」雙重確認彈窗流程（先確認一次、再最終確認一次）。**目前僅為前端 UI**，尚未串接帳號系統／後端資料庫，實際刪除邏輯需等後端建置完成後才會生效。

> 備註：使用者曾提供一份提及 `index.css`／`Layout.jsx`／`PracticeHeader`／`Settings.jsx` 的規格（App 名稱「DancePal」），這些檔名與本專案架構不符，研判來自另一個專案／工具產出的規格文字。上述新增功能已依「需求本身」（safe-area、停用系統選單、停用過度捲動、刪除帳號雙重確認）套用到本專案實際檔案（`index.html`、`just-groove-app/App.js`）。

---

## 5. 建議技術棧（正式 App）

- **跨平台框架**：React Native（Expo）或 Flutter，皆可一套程式碼出 iOS + Android
- **影片播放/處理**：
  - React Native: `react-native-video`（播放、變速、鏡像用 transform）＋ `react-native-vision-camera` 或 `expo-camera`（錄影）
  - Flutter: `video_player` ＋ `camera` 套件
- **AB 循環**：監聽播放進度（position listener），到達 B 點時 seek 回 A 點，邏輯與附上原型的 `timeupdate` 監聽一致
- **語音指令**：iOS 用 `Speech` framework／Android 用 `SpeechRecognizer`，或用跨平台套件如 `@react-native-voice/voice`
- **本機影片存取**：`expo-image-picker` / `react-native-image-picker`（含 video）
- **錄影比對**：左右或上下並排兩個 video view，其中一個接錄影後的本機檔案

---

## 6. 附件

- `index.html`：網頁互動原型，雙擊或用瀏覽器開啟即可測試鏡像、變速、AB 循環、亮度、全螢幕、文字/語音指令、相機錄影對比（IG 匯入為說明彈窗，不做實際抓取）。適合快速預覽功能邏輯。
- `just-groove-app/`：**正式原生 App 專案原始碼**（React Native + Expo），包含 `App.js`、`app.json`、`eas.json`、`BUILD.md`。這是要交給 Antigravity 執行建置指令、產出真正可安裝 ipa / apk 的主要專案。
