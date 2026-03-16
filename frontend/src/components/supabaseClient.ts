import { createClient } from '@supabase/supabase-js';

// 💡 用 (import.meta as any) 避開 TypeScript 的類型檢查
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);