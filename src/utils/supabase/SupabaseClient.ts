import { createClient, type User as SupabaseAuthUser } from '@supabase/supabase-js';
import {
  getSupabaseAnonKey,
  getSupabaseApiOrigin,
  isSupabaseConfiguredFromEnv,
} from './publicConfig';

function emptyBodyHint(url: string): string {
  const lines = [
    'Respons dari server kosong (bukan JSON). Ini bukan karena “tabel database belum dibuat”: login Auth tidak memakai tabel SQL Anda.',
    'Biasanya URL Supabase, anon key, atau proxy tidak cocok. Wajib isi KEDUA VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY untuk project yang sama.',
    'Jika salah satu kosong, app memakai fallback lama di src/utils/supabase/info.tsx — proxy bisa mengarah ke host lain sementara key beda, dan respons bisa kosong/aneh.',
    'Buat file .env.local di root project (sejajar package.json), salin dari .env.example, isi dari Dashboard → Settings → API, lalu restart npm run dev.',
  ];
  if (url.includes('/__supabase')) {
    lines.push(
      'Proxy /__supabase: Vite harus memuat .env.local; nama variabel harus diawali VITE_ (bukan NEXT_PUBLIC_).',
    );
  }
  return lines.join(' ');
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const urlSet = Boolean(import.meta.env.VITE_SUPABASE_URL?.trim());
  const keySet = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY?.trim());
  if (!isSupabaseConfiguredFromEnv()) {
    const missing = [!urlSet && 'VITE_SUPABASE_URL', !keySet && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean);
    console.warn(
      `[it-helpdesk] Supabase: set ${missing.join(' dan ')} di .env.local (root project), lalu restart dev server. ` +
        'Tanpa keduanya, URL/key memakai src/utils/supabase/info.tsx (project lama), bukan Supabase baru Anda.',
    );
  }
}

/**
 * Supabase Auth calls `response.json()` directly. Empty bodies (wrong host, bad proxy, HTML error)
 * throw "Unexpected end of JSON input". Return a parseable JSON error instead.
 */
async function supabaseSafeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  const text = await res.text();
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : typeof input === 'object' && input !== null && 'url' in input
            ? String((input as { url: string }).url)
            : '';

  if (!text.trim()) {
    const status = res.ok ? 502 : res.status;
    const body = JSON.stringify({
      code: 'empty_response',
      error_code: 'empty_response',
      msg: emptyBodyHint(url),
      error_description: emptyBodyHint(url),
    });
    return new Response(body, {
      status,
      statusText: res.statusText || 'Error',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (res.ok) {
    try {
      JSON.parse(text);
    } catch {
      const body = JSON.stringify({
        code: 'invalid_json',
        error_code: 'invalid_json',
        msg: `Respons bukan JSON yang valid. ${emptyBodyHint(url)}`,
        error_description: `Respons bukan JSON yang valid. ${emptyBodyHint(url)}`,
      });
      return new Response(body, {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  }

  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export const supabase = createClient(getSupabaseApiOrigin(), getSupabaseAnonKey(), {
  global: { fetch: supabaseSafeFetch },
});

/** Maps Supabase Auth user to the shape used across the app (see App.tsx User). */
export function mapSupabaseUser(su: SupabaseAuthUser) {
  const role =
    su.user_metadata?.role === 'support' ? ('support' as const) : ('user' as const);
  return {
    id: su.id,
    email: su.email ?? '',
    user_metadata: {
      name: String(su.user_metadata?.name ?? ''),
      role,
    },
  };
}
