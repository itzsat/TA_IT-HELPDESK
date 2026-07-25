export type ReadJsonSafeResult<T> = {
  ok: boolean;
  status: number;
  text: string;
  json: T | null;
};

/**
 * Avoids `Unexpected end of JSON input` when the server returns an empty body
 * (or non-JSON error page). Read `text` first, then JSON-parse if possible.
 */
export async function readJsonSafe<T = any>(
  response: Response,
): Promise<ReadJsonSafeResult<T>> {
  const text = await response.text();
  if (!text) {
    return { ok: response.ok, status: response.status, text: '', json: null };
  }
  try {
    return {
      ok: response.ok,
      status: response.status,
      text,
      json: JSON.parse(text) as T,
    };
  } catch {
    return { ok: response.ok, status: response.status, text, json: null };
  }
}

