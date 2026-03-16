# Report Link 設定與測試

## 1. SQL：補齊 `jobs.share_token`

- **檔案：** `backfill-jobs-share-token.sql`
- **步驟：** Supabase Dashboard → SQL Editor → 貼上腳本 → Run
- **結果：** 查詢結果會有一欄 `affected_row_count`，表示本次被更新的列數。之後每筆 job 都有唯一 `share_token`，報告連結即可使用。

## 2. Backend：`reports.ts`

- **Public：** `GET /api/reports/report/:token` 用 `jobs.share_token = :token` 查詢，回傳 job + nested company 的 JSON；找不到或 token 無效則 404 + `{ error: 'Report Not Found' }`。
- **Protected：** `GET /api/reports/stats/:companyId` 仍使用 `verifyToken` + `resolveCompany`。

## 3. Backend：`index.ts`

- `app.use('/api/reports', reportsRouter)` 不掛 auth，讓 public report 可匿名存取。
- 其他 API（companies, staff, jobs, billing）維持 `apiAuth`。

## 4. Frontend：`JobReport.tsx`

- 使用 `fetch(apiUrl(\`/api/reports/report/${encodeURIComponent(token)}\`))`，`token` 來自 route param。
- `!res.ok` 或 `data.error === 'Report Not Found'` 時顯示既有「Report Not Found」UI。

## 5. 測試清單

1. **DB：** 執行上述 SQL，確認所有 job 的 `share_token` 皆非 NULL（或再跑一次，`affected_row_count` 應為 0）。
2. **複製連結：** 在 Edit Job Modal 點「Copy report link」。
3. **開啟報告：** 瀏覽器打開 `/report/<share_token>`，應顯示該 job 的報告頁。
4. **404：** 開啟 `/report/invalid-token-123`，應顯示「Report Not Found」與 Try Again。
