import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export const supabase = (() => {
  if (!supabaseUrl || !supabaseKey) {
    // ビルド時は空のプロキシを返す
    return new Proxy({} as SupabaseClient, {
      get: () => {
        throw new Error('Supabase client not initialized. Check environment variables.');
      }
    });
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
})();
