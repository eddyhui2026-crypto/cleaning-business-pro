# 同英國大型清潔公司 App 對比

參考：CleanerHQ、ProCleanerUK、My Cleaning App、TidyTime、CleaningApp UK 等。

---

## 一、已修正嘅邏輯錯誤

### 1. Staff 按「Complete」後無自動計 cleaner pay ✅ 已修
- **問題**：Staff 喺 app 撳「完成」只會將 job 設為 `completed`，但 **cleaner_pay** 唔會即時計，要 admin 去 Payroll 撳「Recalculate」或者改 job 先有數，payslip 會顯示 £0.00。
- **修正**：`POST /api/jobs/complete/:jobId` 而家會喺 update 之後 call `calculateCleanerPayForJob(jobId, companyId)`，同 PATCH job → completed 行為一致。

### 2. Bookings 標做「Coming soon」但功能已存在 ✅ 已修
- **問題**：Bottom nav「More」入面 Bookings 寫「coming soon」，但 AdminBookingsPage 已經可以 list、convert to job、send quote，會令用戶以為未開放。
- **修正**：已移除 Bookings 嘅 `comingSoon: true`，當正常功能入口。

---

## 二、流程／邏輯上要留意嘅地方（未當 bug 修）

| 項目 | 說明 | 建議 |
|------|------|------|
| **Invoice number prefix** | Customer approve quote 時 create 嘅 invoice，可能用唔到 company 嘅 `invoice_number_prefix`（要睇 customer.ts 有無用 `nextInvoiceNumber(companyId)`）。 | 檢查 quote approve 造 invoice 時有無用同一個 nextInvoiceNumber，同埋用 company prefix。 |
| **Payment 唔會 check 金額** | Record payment 時無驗證 `amount` 是否 ≤ invoice 餘額，可以錄多過 total。 | 可選：backend 加 check，或至少 frontend 提示。 |
| **新 job 日期** | 無強制 `scheduled_at` 必須係未來（或今日），可以開「聽日之前」嘅 job。 | 可選：new job / recurring 時 validate。 |
| **Guest booking** | 現時 booking 一定要 customer 登入先 submit；無「guest 填表 → 之後再 link 客戶」。 | 大公司多數有 guest checkout；可當 enhancement。 |

---

## 三、功能上同英國大 app 比，你差啲乜

### 你已經有、同佢哋對齊嘅
- 預約／booking、convert to job、recurring jobs  
- Quote → approve → job + invoice  
- Invoice、send email、record payment、PDF  
- Staff app：job list、check-in/complete、before/after 相、checklist  
- Clock in/out、attendance、payroll hours、payslip PDF  
- Customer dashboard、report by token、company settings、UK 服務/定價  

### 佢哋有、你暫時無（可當 roadmap）

| 功能 | 英國大 app 常見做法 | 你而家 |
|------|----------------------|--------|
| **Offline 模式** | ProCleanerUK 等：無網絡都可以睇 schedule、clock、upload 相，有網再 sync。 | 要網絡，無 offline。 |
| **GPS 限制定點 clock-in** | 只准喺 job 地址附近（例如 100m）先可以 clock in，防作弊。 | ✅ 已有：`staff/clock-in` 用 `distanceMeters` + `CLOCK_IN_RADIUS_METERS`（100m）驗證，job 無設座標會拒絕 clock in。 |
| **Mileage / 車程** | 自動記路線、里數，入 payroll 或報銷。 | 無自動 mileage tracking。 |
| **實時 staff 地圖** | Admin 睇地圖：每個 staff 而家喺邊。 | 你有 `GET /api/admin/staff-locations`（latest clock_in 位置），可以喺地圖顯示，要確認 Dashboard 有無用。 |
| **遲到提醒** | 例如 job start 前 15 分鐘未到就 push/email 提醒 admin 或客戶。 | 無自動「遲到 alert」。 |
| **網上收款** | CleanerHQ：Stripe/PayPal 等，客戶直接 pay invoice。 | 只有 record payment（cash/bank_transfer 等），`stripe_placeholder` 未接真正 Stripe 收款。 |
| **Route 優化** | 日曆上按路線排 order，減車程。 | 無 route optimization。 |
| **客戶聯絡對 staff 隱藏** | 可設定唔俾 cleaner 睇客戶電話/地址。 | 無呢個開關；staff 會睇到 job 嘅 client/address。 |
| **簡化模式 / 多語** | 俾非英語員工用簡化 UI 或多語言。 | 無。 |
| **Holiday/sickness 自報** | Staff 自己報放假/病假，admin 睇。 | 無 self-service leave。 |
| **Equipment / 庫存** | 部分有器材、用品 tracking。 | 無。 |

---

## 四、流程對比（有無錯漏）

- **Booking → Job → Assign → Do job → Invoice → Payment**  
  你嘅流程完整：booking 可 convert to job、assign staff、staff check-in/complete、invoice 同 record payment 都有，無明顯漏 step。  
- **Quote → Approve → Job + Invoice**  
  有；approve 會 create job + invoice，admin 亦可 convert to job。  
- **Recurring → 每日生成 job**  
  有 cron 做；要留意 timezone 同「已存在同一天嘅 job 唔重複」邏輯（你已有 skip）。  
- **完成 job 後**  
  而家會自動計 cleaner pay，payslip 會出到數；notification 俾客戶你已有。

整體無大嘅流程錯誤，主要係「同大公司比少咗一啲進階功能」，而唔係邏輯反轉或漏 step。

---

## 五、總結

- **邏輯錯誤**：已修兩個——(1) Staff Complete 會自動計 cleaner pay；(2) Bookings 唔再標 coming soon。  
- **流程**：無發現明顯錯漏；booking/quote/job/invoice/payment 鏈條完整。  
- **同英國大 app 比**：你差嘅主要係：offline、GPS 限制定點 clock-in、mileage、網上收款、遲到提醒、route 優化、客戶資料對 staff 隱藏、多語/簡化模式等，可當日後 enhancement 逐樣加。
