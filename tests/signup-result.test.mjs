import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserClient } from '@supabase/ssr';
import { signupErrorState } from '../components/signup/signup-result.mjs';

// The installed SDK is exercised with a synthetic transport; no provider is called.
async function signupWith(fetcher) {
  let calls = 0;
  const client = createBrowserClient('https://example.supabase.co', 'sb_publishable_test', {
    isSingleton: false,
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
    cookies: { getAll: () => [], setAll: () => {} },
    global: { fetch: (...args) => { calls++; return fetcher(...args); } },
  });
  const result = await client.auth.signUp({ email: 'fixture@example.test', password: 'synthetic-password-123' });
  return { result, calls };
}
const failure = (status, payload) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' },
});

test('explicit validation and rate-limit rejections allow manual correction without a retry', async () => {
  for (const [status, code] of [[400, 'email_address_invalid'], [422, 'validation_failed'], [429, 'over_email_send_rate_limit']]) {
    const { result, calls } = await signupWith(async () => failure(status, { code, msg: 'synthetic rejection' }));
    assert.equal(calls, 1);
    assert.equal(signupErrorState(result.error), 'error');
  }
});

test('weak password is a confirmed SDK rejection, not an unknown outcome', async () => {
  const { result, calls } = await signupWith(async () => failure(400, { code: 'weak_password', msg: 'synthetic weak password', weak_password: { reasons: ['length'] } }));
  assert.equal(calls, 1);
  assert.equal(result.error?.name, 'AuthWeakPasswordError');
  assert.equal(signupErrorState(result.error), 'error');
});

test('provider failure and transport loss remain unknown without automatic retry', async () => {
  for (const fetcher of [async () => failure(500, { msg: 'synthetic failure' }), async () => { throw new Error('synthetic transport loss'); }]) {
    const { result, calls } = await signupWith(fetcher);
    assert.equal(calls, 1);
    assert.equal(signupErrorState(result.error), 'unconfirmed');
  }
  assert.equal(signupErrorState({ status: 400 }), 'unconfirmed');
  assert.equal(signupErrorState(null), 'unconfirmed');
});
