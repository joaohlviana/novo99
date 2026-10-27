import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAdultConsent } from '../components/signup/register-validation.mjs';

test('consent is accepted only for the explicitly checked HTML checkbox', () => {
  const values = new FormData();
  assert.equal(hasAdultConsent(values), false);
  values.set('adult', 'false');
  assert.equal(hasAdultConsent(values), false);
  values.set('adult', 'on');
  assert.equal(hasAdultConsent(values), true);
});
