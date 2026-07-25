import { createClient } from '@supabase/supabase-js';
import { getSupabaseHttpOrigin, getSupabaseAnonKey } from './publicConfig';

const SUPABASE_URL = getSupabaseHttpOrigin();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

// Kunci yang Anda berikan bukan JWT Service Role yang valid, sehingga tidak bisa digunakan untuk menembus RLS.
// Kita harus menggunakan anon key, dan RLS di database HARUS dimatikan/diizinkan secara manual.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
