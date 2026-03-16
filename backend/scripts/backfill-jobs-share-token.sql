-- =============================================================================
-- 用途：為 jobs 表補齊 share_token（UUID），確保每筆 job 都有唯一報告連結 token。
-- 執行後會回傳本次更新的筆數 (affected_row_count)。
-- 在 Supabase SQL Editor 貼上整段執行即可。
-- =============================================================================

-- 1. 啟用 uuid-ossp（提供 uuid_generate_v4()）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 對 share_token 為 NULL 的列寫入新 UUID，並回傳影響筆數
WITH updated AS (
  UPDATE jobs
  SET share_token = uuid_generate_v4()
  WHERE share_token IS NULL
  RETURNING id
)
SELECT COUNT(*) AS affected_row_count FROM updated;
