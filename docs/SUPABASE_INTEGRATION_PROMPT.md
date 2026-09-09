# Supabase 串接提示詞

將以下內容貼給負責串接的開發代理：

```text
請在 Expo SDK 57 + React Native Web 專案中完成 JUST GROOVE 的 Supabase 串接。

目標：
1. 使用 @supabase/supabase-js 建立瀏覽器安全的 client，只讀取 EXPO_PUBLIC_SUPABASE_URL 與 EXPO_PUBLIC_SUPABASE_ANON_KEY，禁止使用 service_role key。
2. 接通 Email 註冊、Email 登入、Google OAuth、登出與 getSession；頁面重新整理後要恢復 session。
3. Google OAuth redirect 必須使用目前部署網址（window.location.origin），並在 Supabase Auth URL Configuration 同時加入本機與 Vercel URL。
4. 執行 supabase/migrations/001_projects.sql，projects 表所有 CRUD 都必須使用 user_id = auth.uid() 的 RLS；不可只檢查 authenticated role。
5. 專案資料包含 id、user_id、title、source、cover_uri、duration_ms、pinned、settings、created_at、updated_at。
6. 影片 Storage 路徑固定為 <user_id>/<project_id>/<filename>，建立 private bucket user-videos；Storage 的 select/insert/update/delete policy 都必須限制第一層資料夾等於 auth.uid()。
7. 登入成功後載入目前 user_id 的 projects；登出時清除雲端查詢結果並切換到 guest 本機空間，不可看到上一位使用者的資料。
8. 登入、註冊、Google、登出、上傳、刪除、重新命名、置頂每個按鈕都要有 loading、成功與錯誤狀態；錯誤需顯示在 UI，不得只 console.log。
9. 沒有環境變數時維持訪客模式，登入按鈕顯示清楚的設定提示，並提供「先以訪客模式使用」。
10. 執行 npm run web:export，使用瀏覽器實際測試 Email 登入、註冊、Google redirect、登出、兩個帳號資料隔離及 RLS；回報每個測試結果與失敗原因。

完成後請列出：環境變數、Supabase Dashboard 設定、redirect URLs、migration 執行結果、測試網址與尚未完成項目。
``` 

## Dashboard 必填設定

在 Supabase Authentication → Providers 啟用 Email 與 Google，並在 URL Configuration 加入：

- `http://localhost:8081`
- `https://dist-4wy0afclr-peipei1.vercel.app`

在 Vercel Preview/Production 設定 `EXPO_PUBLIC_SUPABASE_URL` 與 `EXPO_PUBLIC_SUPABASE_ANON_KEY`，重新部署後才會啟用真正登入。
