# JUST GROOVE UI/UX 與資料架構

## 本次模組

- `src/components/BrandIntroOverlay.js`：1.3 秒品牌 Logo overlay；以 `sessionStorage` 控制同一造訪只顯示一次。
- `src/context/AuthContext.js`：Supabase session、Email、Google OAuth；沒有環境變數時安全地回到訪客模式。
- `src/store/ProjectContext.js`：專案狀態、置頂排序、本機命名空間（`@just-groove/projects-v2:<userId>`），Supabase 設定完成後自動同步。
- `src/components/ProjectMenu.js`：置頂、改名、複製、刪除的下拉操作面板。
- `src/components/OnboardingOverlay.js`：首次登入/首次訪客導覽，使用 `hasSeenOnboarding:<userId>`。
- `src/components/AuthModal.js`：Email 登入/註冊與 Google 登入入口。

## 安裝與環境

```bash
npm install @supabase/supabase-js
cp .env.example .env.local
```

在 Supabase 專案設定 URL、anon key，啟用 Google provider，並執行 `supabase/migrations/001_projects.sql`。部署到 Vercel 時將相同兩個 `EXPO_PUBLIC_*` 變數加入 Preview/Production。

目前工作區沒有已連結的 Vercel project，因此 Marketplace provisioning 仍需在你的 Vercel 帳號完成。完成後再部署即可讀到環境變數。

## 狀態流

`AuthProvider → ProjectProvider → Navigation`。Auth session 改變時，ProjectProvider 會切換 user namespace；訪客使用本機 `guest` 空間，登入使用 `user.id` 空間。Supabase RLS 以 `auth.uid() = user_id` 限制查詢、寫入與刪除，影片 Storage 建議以 `<user_id>/...` 作為路徑並套用相同規則。
