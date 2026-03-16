# 老闆新增員工 + Plan 限制 + 日曆拖曳

## A. 後端：POST /api/staff

### 流程
1. **requireAdmin**：只允許 `role === 'admin'`。
2. **checkStaffLimit**：依公司 `plan` 檢查現有員工數是否已達上限（Starter 20、Standard 50、Premium 無限）。
3. 驗證 body：`full_name`、`phone` 必填；`role` 可選（僅會建立 `staff`，不會建立 admin）。
4. **Phone 唯一**：同一 `company_id` 內 `phone` 不可重複（先查 `profiles`，再寫入）。
5. **系統自動生成**：
   - 臨時密碼：`crypto.randomBytes(6)` 轉成 10 字元
   - 登入用 email：`staff-{uuid}@invite.cleaning.local`（Supabase Auth 用，唯一）
   - `id`、`created_at`、`updated_at`：由 Supabase Auth + DB 產生
6. **Supabase Auth**：`supabase.auth.admin.createUser({ email, password, email_confirm: true })`。
7. **profiles**：`INSERT` 一筆，`id = auth.user.id`，`company_id = req.companyId`（絕不從 client 取）。
8. 回傳 profile + **loginEmail** + **temporaryPassword**（只回傳一次，請老闆轉交員工）。

### 欄位對應

| 來源 | 欄位 | 說明 |
|------|------|------|
| **老闆提供** | full_name | 必填 |
| **老闆提供** | phone | 必填，同一公司內不可重複 |
| **老闆提供** | role | 可選，目前只會建立 staff |
| **系統生成** | id | Auth 用戶 UUID |
| **系統生成** | email | 內部用登入 email（invite.cleaning.local） |
| **系統生成** | 密碼 | 臨時密碼，回傳一次 |
| **系統生成** | company_id | 從 req.companyId（登入者所屬公司） |
| **系統生成** | created_at / updated_at | DB 預設 |

### JSON 回傳範例（201 Created）

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "company_id": "a0000001-0001-4000-8000-000000000001",
  "full_name": "John Doe",
  "phone": "+447700123456",
  "email": "staff-a1b2c3d4-...@invite.cleaning.local",
  "role": "staff",
  "created_at": "2025-03-08T12:00:00.000Z",
  "updated_at": "2025-03-08T12:00:00.000Z",
  "name": "John Doe",
  "loginEmail": "staff-a1b2c3d4-...@invite.cleaning.local",
  "temporaryPassword": "Ab1Cd2Ef3G",
  "message": "Share the login email and temporary password with the staff member so they can sign in."
}
```

### SQL：Phone 唯一約束

已提供 migration：`supabase/migrations/004_profiles_phone_unique.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_company_phone_unique
ON profiles (company_id, phone)
WHERE phone IS NOT NULL AND phone != '';
```

---

## B. 前端表單建議（已實作）

- **欄位**：`full_name`、`phone`、`role`（固定 staff）。
- **自動生成**：密碼與登入 email 由後端產生，成功後在畫面上顯示「Share with staff」區塊（loginEmail + temporaryPassword + Copy 按鈕）。
- **Plan 限制提示**：顯示「Plan: starter — Staff 3 / 20」；達上限時顯示 `UpgradePrompt` 並禁用「Add to Team」。
- **錯誤**：409 顯示「此電話已存在」；403 顯示「Staff limit reached」或升級提示。

---

## C. 提示：老闆提供 vs 系統生成

| 老闆提供 | 系統自動生成 |
|----------|----------------|
| full_name | id (UUID) |
| phone | email（登入用） |
| role（可選） | 臨時密碼 |
| — | company_id（從登入者） |
| — | created_at, updated_at |

員工**無法自行註冊**；只能由老闆（admin）在後台新增，並把回傳的 **loginEmail** 與 **temporaryPassword** 轉交員工登入。

---

## D. 日曆拖曳檢查（已實作）

- **Starter**：`editable: false`，日曆僅可點選時段開新 job、點事件開 EditModal，**不可**拖曳改期。
- **Standard / Premium**：`editable: true`，並設定 `eventDrop: handleEventDrop`；拖曳後呼叫 `PATCH /api/jobs/:id` 更新 `scheduled_at`，成功則重新 fetch，失敗則 `info.revert()`。

邏輯在 `Dashboard.tsx`：`usePlan().isStandardOrPremium` 決定是否啟用 drag/drop。

---

## E. Multi-tenant 安全

- **company_id**：所有 API 的 `company_id` 一律來自 `req.companyId`（由 `resolveCompany` 從 profiles 讀取），**絕不**使用 client 傳的 companyId。
- **新增員工**：只允許 `role === 'admin'`（`requireAdmin`）；`checkStaffLimit` 依該公司的 plan 檢查人數。
- **刪除員工**：DELETE /api/staff/:id 僅能刪除 `company_id === req.companyId` 且 `role !== 'admin'` 的 profile。
- **日曆 / jobs**：GET/POST/PATCH/DELETE jobs 全部以 `req.companyId` 做篩選或寫入。
