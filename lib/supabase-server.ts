import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config.mjs';

// Server Actions and Route Handlers can write cookies. RSC callers must use the
// read-only mode: a refresh requiring Set-Cookie fails closed rather than hiding it.
export async function serverSupabase(writable: boolean) {
  const config = supabaseConfig(process.env);
  if (!config || process.env.AUTH_SSR_ENABLED !== 'true') throw new Error('AUTH_UNAVAILABLE');
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: {
      getAll() { return jar.getAll(); },
      setAll(items: {name:string;value:string;options:CookieOptions}[]) {
        if (!writable && items.length) throw new Error('AUTH_REFRESH_REQUIRED');
        for (const {name,value,options} of items) jar.set(name,value,options);
      },
    },
  });
}

export function authOrigin() {
  const input = process.env.AUTH_APP_ORIGIN;
  try {
    const origin = new URL(input || '');
    if (origin.origin !== input || origin.username || origin.password || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && origin.hostname === 'localhost'))) return null;
    return origin.origin;
  } catch { return null; }
}
