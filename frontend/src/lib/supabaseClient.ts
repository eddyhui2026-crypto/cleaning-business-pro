import { createClient } from '@supabase/supabase-js';

// 使用 import.meta.env 讀取 Vite 環境變數
// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 安全檢查：確保變數有成功讀取
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Supabase 設定錯誤：找不到 URL 或 Key。\n" +
    "請檢查 frontend/.env 檔案是否存在，且變數名稱是否正確（需以 VITE_ 開頭）。"
  );
}

// 建立並匯出 Supabase 客戶端實例
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,   // 👈 必須：確保重新整理後唔會叫你重新登入
    autoRefreshToken: true, // 👈 必須：Token 過期前會自動幫你換新
    detectSessionInUrl: true
  }
});