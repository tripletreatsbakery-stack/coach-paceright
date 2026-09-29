import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function publicKey(k) {
  if (!k || k.startsWith('sb_secret_')) return false;
  if (k.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(k.split('.')[1])).role === 'anon'; } catch { return false; }
}
export const client = url && publicKey(key) ? createClient(url, key, {auth: {persistSession: false, autoRefreshToken: true, detectSessionInUrl: false}}) : null;
