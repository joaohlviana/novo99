import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthFence, requireSameOrigin } from '../lib/auth-fence.mjs';

const a = { userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionId:'11111111-1111-4111-8111-111111111111', authorizationRevision:0 };
const b = { userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sessionId:'22222222-2222-4222-8222-222222222222', authorizationRevision:0 };
const code = expected => err => err.code === expected;

test('same verified session retains marker across refresh, while another account and another session fail closed', () => {
  const fence=createAuthFence(Buffer.alloc(32,1));
  const marker=fence.issue(a);
  fence.requireMatch({...a}, marker);
  assert.throws(() => fence.requireMatch(b, marker),code('SESSION_CHANGED'));
  assert.throws(() => fence.requireMatch({...a,sessionId:b.sessionId}, marker),code('SESSION_CHANGED'));
  assert.throws(() => fence.requireMatch(a, ''),code('SESSION_CHANGED'));
  assert.throws(() => fence.requireMatch({...a, sessionId:null}, marker),code('IDENTITY_UNAVAILABLE'));
});

test('revision changes including ABA invalidate a previous marker', () => {
  const fence=createAuthFence(Buffer.alloc(32,2));
  const old=fence.issue(a);
  assert.throws(() => fence.requireMatch({...a, authorizationRevision:1},old),code('SESSION_CHANGED'));
  assert.throws(() => fence.requireMatch({...a, authorizationRevision:2},old),code('SESSION_CHANGED'));
  fence.requireMatch({...a, authorizationRevision:2},fence.issue({...a, authorizationRevision:2}));
});

test('tampering and invalid configuration fail closed', () => {
  assert.throws(() => createAuthFence(Buffer.alloc(31)),code('FENCE_KEY_INVALID'));
  const fence=createAuthFence(Buffer.alloc(32,3));
  assert.throws(() => fence.requireMatch(a,'v1.'+'A'.repeat(43)),code('SESSION_CHANGED'));
  for(const rev of [-1,1.1,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => fence.issue({...a, authorizationRevision:rev}),code('IDENTITY_UNAVAILABLE'));
});

test('mutations can require exact configured origin without accepting suffixes, null or paths', () => {
  requireSameOrigin('https://preview.example.test','https://preview.example.test');
  for(const origin of ['null','https://preview.example.test.evil.test','https://evil.test',null]) assert.throws(() => requireSameOrigin(origin,'https://preview.example.test'),code('ORIGIN_INVALID'));
  assert.throws(() => requireSameOrigin('https://preview.example.test','https://preview.example.test/path'),code('ORIGIN_INVALID'));
});
