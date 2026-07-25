// Minimal shims to satisfy local TypeScript/linter in Node env.
// This file is only for editor/linting; actual runtime is Deno (Supabase Edge Functions).

declare module 'npm:hono';
declare module 'npm:hono/cors';
declare module 'npm:hono/logger';
declare module 'npm:@supabase/supabase-js@2';

// Deno global for Edge Functions
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: any) => void;
};


