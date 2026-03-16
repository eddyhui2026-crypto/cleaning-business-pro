# CleanFlow Web App — 功能一覽

適用於英國清潔公司嘅營運系統，主要分三類使用者：**公司管理員 (Admin)**、**清潔員工 (Staff)**、**客戶 (Customer)**。

---

## 一、公司管理員 (Admin)

登入後可經 **Dashboard**、底欄 **Schedule / Invoices / Payroll / Settings** 同 **More** 進入各功能。

### 1. Dashboard（主控台）
- 月曆顯示所有 job，按日期睇 schedule
- 快速新增 job（Create job）
- 點擊 job 可編輯、睇詳情
- 當日/本週 job 數量、今日現金收入
- 每日備註 (daily remarks)
- 員工實時位置地圖 (staff locations)
- 未付/待跟進發票一覽
- 可回報問題 (report bug/feedback)
- 英國銀行假期標示

### 2. Schedule（排程）
- 以月曆/週曆顯示 job
- 按日期、員工、job 篩選
- 新增、編輯、刪除 job
- 分配員工 (assign staff)

### 3. Attendance & Payroll（出勤與出糧）
- **篩選**：日期範圍 (From/To)、員工、Job；快捷鍵：This week / Last week / Last 2 weeks / This month / Last month
- **Payroll hours**：每位員工嘅總工時同總薪酬（幾多個鐘、出幾多糧）
- **公司預設 pay**：喺頂欄設定公司 default（時薪 / % / 固定），撳 Edit 入 Payroll Settings
- **每位員工 pay**：每行右邊可改該員工嘅 **£/hr、%、£ fix** 三個欄位，改完撳 **Save**（只會改嗰個員工）；揀咗單一員工時會顯示提示「Only this employee's pay」
- **Recalculate hours**：按現有 round 設定重計該時段工時
- **Payroll Settings**：工時舍入方法（5/10/15/60 分鐘）、公司預設 pay type 同金額
- **Clock-out**：可為仍 clocked in 或需更正嘅 record 設定 clock-out 時間同 optional 人工 override
- **下載 PDF**：Report (PDF) 俾會計用嘅 payroll summary；Payslips (PDF) 每人一版糧單

### 4. Invoices（發票）
- 發票列表、新增、編輯
- 發 PDF、發送俾客戶
- 付款記錄 (payments)

### 5. Customers（客戶）
- 客戶名單、新增、編輯、刪除
- 客戶詳情頁：基本資料、notes、bookings、invoices、quotes、payments、payment settings
- 可設定公司 booking slug（客戶預約連結用）

### 6. Recurring jobs / Job detail（週期性 job）
- 週期性 job 列表、新增、編輯、刪除
- 系統每日自動根據 template 生成對應 job

### 7. Quotes（報價）
- 報價列表、新增、編輯
- 出 PDF、發送俾客戶
- 可將報價轉成 job (convert to job)

### 8. Bookings（預約）
- 睇客戶經 booking 頁提交嘅預約
- 可將預約轉成 job 或轉成 quote

### 9. Services（服務項目）
- 服務目錄（清潔服務等）
- 新增、編輯、刪除；可 import UK standard、確保 booking 預設

### 10. Jobs 新增頁 (/admin/jobs/new)
- 建立單次 job，填客戶、時間、地址、分配員工等

### 11. Settings（設定）
- 公司名稱、聯絡 email、logo、report footer、booking slug
- 與 Payroll 相關嘅公司預設（另見 Payroll Settings）

### 12. Settings → Checklists
- Checklist 範本設定（job 完成時用）

### 13. Staff management（員工管理，經 Dashboard 或相關入口）
- 員工名單、新增、刪除
- 設定員工 pay（時薪 / % / 固定），Team Hub 等處可 set pay

### 14. Billing（訂閱）
- 訂閱狀態、升級、Stripe 付款
- Trial 到期後需訂閱先可繼續用 admin 功能

### 15. 其他
- Push notification 訂閱（admin）
- 依 plan 限制 staff/job 數量 (usage)

---

## 二、清潔員工 (Staff)

經 **Staff login** 登入，有自己嘅 dashboard 同 job 列表。

### 1. Staff Dashboard
- 睇自己嘅 job 列表
- 更改密碼
- 上傳 job 前/後相片

### 2. Jobs 列表 (/staff/jobs)
- 睇派俾自己嘅 job

### 3. Job 詳情 (/staff/job/:jobId)
- 睇 job 詳情、地址、時間、checklist
- **GPS Clock in / Clock out**（要喺 job 地點附近先可 clock）
- 完成 checklist、上傳相片、完成 job

### 4. Timesheet (/staff/timesheet)
- 睇自己出勤記錄、工時

### 5. Push notifications
- 員工可訂閱 push 接收 job 相關通知

---

## 三、客戶 (Customer)

經 **Customer login** 或 **/customer** 登入（可用電話等辨識）。

### 1. Customer Dashboard
- 睇自己嘅 bookings、quotes、invoices、jobs

### 2. Book 預約 (/customer/book 或 /book/:slug)
- 按公司 booking 連結預約服務
- 揀服務、時間等

### 3. Quotes
- 睇報價、批准報價 (approve)

### 4. Invoices
- 睇發票、下載 PDF、睇付款指示 (payment instruction)

### 5. 其他
- 忘記密碼、改密碼
- Push 訂閱（客戶）

---

## 四、公開 / 共用

### 1. 首頁 (CleanFlow Home)
- 產品介紹、Features、Pricing、How it works、Testimonials
- 連結：Customer Login、Company Login、Sign up

### 2. Job Report（公開連結）
- 用 token 打開 **/report/:token** 睇單次 job 報告（客戶可睇完成報告、PDF）

### 3. Booking 頁（公開）
- **/book** 或 **/book/:slug**：客戶唔使登入都可揀公司（by slug）再預約

### 4. Health check
- **/api/health**：檢查 backend 同 database 是否正常

---

## 五、技術要點（方便你同開發睇）

- **Auth**：Supabase Auth；Admin 用 company_id，Staff 用 profile role，Customer 用 customer 身份
- **Pay 計算**：優先順序 job pay > staff pay > company default；可設時薪、% 或固定金額
- **Payroll**：工時可依 round 設定舍入；可下載會計用 report PDF 同每人一版 payslips PDF
- **Recurring jobs**：Cron 每日 08:00 生成
- **付款**：Stripe（訂閱、invoices 等）；webhook 處理 Stripe 事件
- **Push**：VAPID / web push，admin 同 customer 都有用

---

以上係依現有 codebase 整理嘅功能清單；若你加咗新頁或新 API，可以再補落呢份 FEATURES.md。
