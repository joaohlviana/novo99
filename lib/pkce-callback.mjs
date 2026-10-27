// Review-only building block. It is deliberately not imported by a route.
// Callers must establish that the callback belongs to the active browser attempt
// and serialize competing Set-Cookie responses before making this reachable.
import { createServerClient } from '@supabase/ssr';
import { supabaseConfig } from './config.mjs';

const CALLBACK_PATH = '/auth/callback';
const SUCCESS_PATH = '/auth/confirmado';
const FLOW_ID = /^[A-Za-z0-9_-]{8,64}$/;

function safeHeaders(sdkHeaders = {}) {
  const result = new Headers(sdkHeaders);
  result.set('cache-control', 'private, no-store');
  result.set('referrer-policy', 'no-referrer');
  result.set('pragma', 'no-cache');
  result.set('expires', '0');
  return Object.fromEntries(result);
}
function failure(reason) { return { ok: false, reason, headers: safeHeaders() }; }

/** Fixed server configuration only; never reflect a redirect from request input. */
export function parsePkceCallback(rawUrl, configuredOrigin) {
  try {
    const origin = new URL(configuredOrigin);
    if (origin.origin !== configuredOrigin || origin.username || origin.password ||
        !(origin.protocol === 'https:' || (origin.protocol === 'http:' && origin.hostname === 'localhost'))) return null;
    const url = new URL(rawUrl);
    if (url.origin !== configuredOrigin || url.pathname !== CALLBACK_PATH || url.hash) return null;
    const codes = url.searchParams.getAll('code');
    const flowIds = url.searchParams.getAll('sb_flow_id');
    if (codes.length !== 1 || !codes[0] || codes[0].length > 2048 || flowIds.length !== 1 || !FLOW_ID.test(flowIds[0])) return null;
    // Do not let an ambiguous provider error and a code produce success.
    if (url.searchParams.has('error') || url.searchParams.has('error_code')) return null;
    return { code: codes[0], flowId: flowIds[0] };
  } catch { return null; }
}

/**
 * Stages SDK cookie writes per invocation. It never sends them itself; even on
 * error the caller must not apply them. Do not persist/log returned cookies.
 * `makeClient` is injectable for tests only; production would use the SDK.
 */
export async function exchangePkceCallback({ rawUrl, configuredOrigin, env, requestCookies, makeClient = createServerClient }) {
  const parsed = parsePkceCallback(rawUrl, configuredOrigin);
  const config = supabaseConfig(env);
  if (!parsed || !config || !Array.isArray(requestCookies)) return failure('invalid');
  const staged = [];
  const headers = {};
  try {
    // Construct per request to prevent session sharing between users.
    const client = makeClient(config.url, config.key, {
      cookies: {
        getAll() { return requestCookies.map(({ name, value }) => ({ name, value })); },
        setAll(cookies, cacheHeaders) {
          for (const cookie of cookies) staged.push(cookie);
          if (cacheHeaders) Object.assign(headers, cacheHeaders);
        },
      },
    });
    const exchanged = await client.auth.exchangeCodeForSession(parsed.code, { flowId: parsed.flowId });
    if (exchanged.error || !exchanged.data?.session) return failure('unconfirmed');
    // getUser consults Auth. Neither cookie contents nor user_metadata confer authorization.
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data?.user || verified.data.user.id !== exchanged.data.user?.id) return failure('unconfirmed');
    return { ok: true, redirect: `${configuredOrigin}${SUCCESS_PATH}`, cookies: staged, headers: safeHeaders(headers) };
  } catch {
    // Do not repeat: the provider may have consumed the single-use code.
    return failure('unconfirmed');
  }
}
