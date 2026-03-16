# Payroll、Clock out、VAT、出糧單與利潤 — 分析與建議

## 1. 員工唔記得 Clock out / 過咗 100 米 Clock 唔到

### 現況
- **Clock in**：必須喺 job 地點 **100m 內**（`CLOCK_IN_RADIUS_METERS`），有 GPS 檢查。
- **Clock out**：後端 **冇** 距離限制，只要 `attendance_id` + `staff_id` 正確就可以 clock out；lat/lng 係 optional。即係理論上員工喺邊度都可以撳 clock out。
- 若果你哋之後加「clock out 都要 100m 內」，就會出現「走咗先記得、或者已經過咗 100m」而 clock 唔到嘅情況。

### 建議做法

| 項目 | 建議 |
|------|------|
| **提醒老闆** | 喺 **Attendance & Payroll** 頁（或 Dashboard）加一個「未 clock out」提示：列出目前 `status = 'clocked_in'` 嘅記錄，等老闆知道邊個仲未收工。 |
| **老闆代 clock out** | 加 **Admin API**：`PATCH /api/admin/attendance/:id/clock-out`（或 `POST /api/admin/attendance/clock-out`），只准 admin、只可操作自己公司嘅 attendance、只可把 `clocked_in` 改做 `clocked_out`，並寫入 `clock_out_time`（同 `total_hours`）。前端 Attendance 表每一行「未 clock out」旁邊加掣「代 clock out」。 |
| **可選：Clock out 都限 100m** | 若要保持「必須喺 job 附近先可 clock out」，就只對 **員工自己** 嘅 clock-out 做 100m 檢查；**Admin 代 clock out** 唔檢查距離，當作特例。 |

咁就可以：
- 員工唔記得 clock out → 老闆見到提示，撳「代 clock out」搞掂。
- 將來若加 100m 限制 → 員工過咗 100m 就由老闆代 clock out。

---

## 2. Add new job — VAT 剔唔剔

### 建議
- 喺 **Total price** 旁邊加一個 **「Include VAT」** checkbox（可剔可唔剔）。
- 儲存時：job 表加欄位 `price_includes_vat BOOLEAN`（或 `charge_vat BOOLEAN`），同 `price` 一齊 save。
- 報價單 / Invoice / Report 若顯示價錢，可以按呢個 flag 顯示「£X + VAT」或「£X (VAT included)」。
- **唔改現有 total price 邏輯**：total 仍然係一個數，VAT 只係「標示」用，方便之後出單同會計。

---

## 3. 每個員工每小時人工唔同 / 每個 job 員工價錢唔同 → Payroll 要正確

### 現況
- Payroll 目前只計 **總時數**（`/api/admin/payroll-hours`：按 staff 匯總 `total_hours`），**冇** 時薪、冇「人工」金額。
- 資料庫 **冇** `profiles.hourly_rate` 或 `job_assignments.rate` 之類欄位。

### 建議（二揀一或一齊要）

| 方案 | 做法 | 優點 |
|------|------|------|
| **A. 每人一個預設時薪** | 喺 `profiles` 加 `hourly_rate NUMERIC`（可 null）。Payroll 顯示：每人總時數 × 佢嘅 hourly_rate = 該員人工；冇 set rate 就只顯示時數或「—」。 | 簡單、出糧單易計：每期總人工 = Σ(時數 × 時薪)。 |
| **B. 每個 job 每個員工唔同價** | 喺 `job_assignments` 加 `pay_rate NUMERIC`（可 null）。計 payroll 時：每條 attendance 對應一個 job + staff，用該 assignment 嘅 `pay_rate`（若 null 就 fallback 去 profiles.hourly_rate）乘 attendance 嘅 `total_hours`。 | 可以「同一 job 唔同人唔同價」、「同一人唔同 job 唔同價」。 |

**建議實作次序**：先做 **A**（profiles 時薪 + payroll 顯示「時數 + 金額」），再做 **B**（job 級別 pay_rate）會易啲接。

---

## 4. 出糧單（Payslip）

### 現況
- 系統 **冇** 出糧單功能：冇 PDF、冇「某個 pay period 嘅人工明細」頁面。

### 建議
- 用上面 **3** 嘅「每人時數 + 時薪 → 人工」計好之後：
  - **Payroll 頁**：加「Pay period」（例如本月 1 號–31 號），列出每人：時數、時薪、應付金額。
  - **出糧單**：加「Download payslip」或「View payslip」— 可選 (1) 網頁顯示一份「Payslip for [Name], [Period]」或 (2) 產生 PDF（類似 invoice PDF）下載。
- 出糧單內容建議：公司名、員工名、pay period、總時數、時薪、應付總額、可選（已扣稅/已扣其他）若你哋有記錄。

---

## 5. Profit 要減人工先係「真利潤」

### 現況
- 有 job `price`（收入），但冇「 labour cost」或「payroll cost」匯總，所以冇 **profit = 收入 − 人工** 嘅畫面。

### 建議
- 當 **3** 做咗「按 staff + 時數 × 時薪」計到每人人工之後：
  - 定義 **某段時間**（例如同 pay period）：  
    - **Revenue** = 該段時間內 completed job 嘅 `price` 總和（若 price 係 string 要 parse）。  
    - **Labour cost** = 該段時間內 payroll 總額（上面計出嚟嘅「每人應付」加總）。  
  - **Profit** = Revenue − Labour cost。
- 喺 **Dashboard** 或 **Attendance & Payroll** 加一個「Profit summary」區塊：選 period → 顯示 Revenue、Labour、**Profit**，老闆就見到減咗人工之後嘅利潤。

若果想再細：可以加「Per job profit」（該 job 收入 − 該 job 上嘅 staff 人工），但實作會複雜啲（要 job 同 attendance 對應好）；第一步做「全公司一段時間」嘅 Revenue / Labour / Profit 已經夠用。

---

## 實作優先次序建議

1. **提醒 + 老闆代 clock out**（解決唔記得 / 距離問題）。
2. **Add new job：VAT checkbox**（改動細、立即有用）。
3. **Profiles 時薪 + Payroll 顯示金額**（payroll 正確嘅基礎）。
4. **（可選）Job assignment pay_rate**（每個 job 每人唔同價）。
5. **出糧單**（Payslip 網頁或 PDF）。
6. **Profit = Revenue − Labour**（Dashboard / Payroll 頁）。

你若想先做邊一兩項，我可以按呢個分析直接幫你改 code（例如先做 1 + 2，再做 3）。
