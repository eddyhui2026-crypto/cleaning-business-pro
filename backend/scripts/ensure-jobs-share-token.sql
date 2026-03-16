-- =============================================================================
-- 用途：為 jobs 表格補齊 share_token
-- - 啟用 uuid-ossp 擴展（用於生成 UUID）
-- - 將 share_token 為 NULL 的記錄更新為新 UUID，以便報告連結可正常使用
-- =============================================================================

-- 1. 啟用 uuid-ossp 擴展（若已啟用則不重複執行）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 為 share_token 為 NULL 的 job 生成並寫入新 UUID
UPDATE jobs
SET share_token = uuid_generate_v4()
WHERE share_token IS NULL;
