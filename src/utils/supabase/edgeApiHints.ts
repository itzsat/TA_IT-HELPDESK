/**
 * Human-readable errors for Supabase Edge Function calls (`/functions/v1/...`).
 */
export function explainEdgeApiFailure(
  status: number,
  json: { code?: string; message?: string; error?: string } | null,
  fallbackText: string,
): string {
  const code = json?.code;
  const fromBody = json?.message || json?.error;
  if (status === 404 || code === 'NOT_FOUND') {
    return [
      'Edge Function `make-server-688b6236` belum di-deploy ke project Supabase ini (NOT_FOUND).',
      'Dari folder project: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npm run supabase:db:push` → `npm run supabase:deploy:function`.',
    ].join(' ');
  }
  if (fromBody) return fromBody;
  if (fallbackText.trim()) return fallbackText.trim().slice(0, 500);
  return `Permintaan gagal (HTTP ${status})`;
}
