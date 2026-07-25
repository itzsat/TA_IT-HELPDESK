/* 
 * File ini adalah fallback jika VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
 * tidak diset di .env.local.
 *
 * Untuk menjalankan project ini, isi .env.local dengan kredensial Supabase kamu:
 *   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
 *   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
 *
 * Lihat .env.example untuk panduan lebih lanjut.
 */

export const projectId = "YOUR_PROJECT_REF"
export const publicAnonKey = "YOUR_SUPABASE_ANON_KEY"