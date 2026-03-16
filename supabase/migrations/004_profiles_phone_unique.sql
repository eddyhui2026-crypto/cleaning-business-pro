-- 同一公司內員工 phone 不可重複（老闆新增員工時檢查）
-- Run after 002_schema.sql. If profiles already has duplicate (company_id, phone), fix data first.

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_company_phone_unique
ON profiles (company_id, phone)
WHERE phone IS NOT NULL AND phone != '';
