import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Backend Supabase credentials missing in .env');
}

// Only warn when key is clearly the wrong type (old publishable prefix). service_role is a JWT starting with eyJ.
if (supabaseServiceKey.startsWith('sb_publishable_')) {
  console.warn(
    '⚠️ SUPABASE_SERVICE_ROLE_KEY looks like anon/publishable key. Use the secret "service_role" key from Supabase Dashboard → Project Settings → API so that auth.admin.createUser() works.'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export { supabase };
export const supabaseAdmin = supabase;