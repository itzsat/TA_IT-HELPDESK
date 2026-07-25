import { projectId, publicAnonKey } from './info';

/** True when both URL and anon key come from `.env.local` / env (recommended for a new Supabase project). */
export function isSupabaseConfiguredFromEnv(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof url === 'string' && url.trim() !== '' && typeof key === 'string' && key.trim() !== '';
}

/**
 * Prefer `VITE_SUPABASE_URL` when `info.tsx` points at a removed project (NXDOMAIN).
 * Example: https://abcdefghij.supabase.co
 */
export function getSupabaseHttpOrigin(): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return `https://${projectId}.supabase.co`;
}

/** Optional override: `VITE_SUPABASE_ANON_KEY` must match the same project as the URL. */
export function getSupabaseAnonKey(): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }
  return publicAnonKey;
}

/**
 * Base URL for browser requests to Supabase (Auth, REST, Edge Functions).
 * On localhost dev/preview, use same-origin `/__supabase` (Vite proxy in vite.config.ts)
 * so calls are not blocked like direct `*.supabase.co` fetches often are.
 */
export function getSupabaseApiOrigin(): string {
  if (typeof window === 'undefined') {
    return getSupabaseHttpOrigin();
  }
  const { hostname, port, origin } = window.location;
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';
  const isVitePreview = port === '4173';
  if (isLocalhost && (import.meta.env.DEV || isVitePreview)) {
    return `${origin}/__supabase`;
  }
  return getSupabaseHttpOrigin();
}

/** Base path for the bundled Edge API in this app. */
export function getEdgeApiBase(): string {
  return `${getSupabaseApiOrigin()}/functions/v1/make-server-688b6236`;
}
