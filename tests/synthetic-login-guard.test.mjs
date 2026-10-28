import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpectedSyntheticLogin } from './browser/synthetic-login-guard.mjs';

test('only the exact generated synthetic credentials can cross the provider boundary', () => {
  const email = 'qa-fixture@example.invalid';
  const password = 'synthetic-incorrect-password';
  const body = { email, password, gotrue_meta_security: {} };
  assert.equal(isExpectedSyntheticLogin(JSON.stringify(body), email, password), true);
  for (const invalid of [
    {...body, email: 'other@example.invalid'},
    {...body, password: 'other'},
    {...body, phone: 'unexpected'},
    {...body, gotrue_meta_security: { captcha_token: 'unexpected' }},
    {email, password},
    null,
  ]) assert.equal(isExpectedSyntheticLogin(JSON.stringify(invalid), email, password), false);
  assert.equal(isExpectedSyntheticLogin('{', email, password), false);
});
