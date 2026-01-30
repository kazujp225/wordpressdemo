import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// service_role keyは必須（フォールバックしない）
// このクライアントはStorage操作専用で、RLSをバイパスする
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export const supabase = (() => {
  if (!supabaseUrl || !supabaseServiceKey) {
    // ビルド時は空のプロキシを返す
    return new Proxy({} as SupabaseClient, {
      get: () => {
        throw new Error('Supabase service client not initialized. SUPABASE_SERVICE_ROLE_KEY is required.');
      }
    });
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseInstance;
})();
