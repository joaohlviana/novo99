import { createBrowserClient } from '@supabase/ssr';
import { supabaseConfig } from './config.mjs';

// The SDK caches its browser client per window. A session is shared between
// tabs; auth-state notifications require consumers to discard private state.
export function browserSupabase() {
  const config = supabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!config) throw new Error('AUTH_UNAVAILABLE');
  return createBrowserClient(config.url, config.key, {
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
  });
}
