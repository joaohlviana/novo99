// Internal contract only: callers must first verify the claims with Supabase.
// This module is not a route or a complete authorization boundary.
import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARKER = /^v1\.[A-Za-z0-9_-]{43}$/;

export class AuthFenceError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function createAuthFence(key) {
  if (!Buffer.isBuffer(key) || key.length < 32) throw new AuthFenceError('FENCE_KEY_INVALID');
  const secret = Buffer.from(key);
  function issue({ userId, sessionId, authorizationRevision }) {
    if (!UUID.test(userId ?? '') || !UUID.test(sessionId ?? '') || !Number.isSafeInteger(authorizationRevision) || authorizationRevision < 0) {
      throw new AuthFenceError('IDENTITY_UNAVAILABLE');
    }
    const payload = JSON.stringify(['99coach-session-v1', userId.toLowerCase(), sessionId.toLowerCase(), authorizationRevision]);
    return `v1.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
  }
  function requireMatch(identity, supplied) {
    // Compute first even if supplied is missing; an authenticated identity without
    // a session ID must fail closed, never be treated as anonymous.
    const expected = issue(identity);
    if (typeof supplied !== 'string' || !MARKER.test(supplied)) throw new AuthFenceError('SESSION_CHANGED');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new AuthFenceError('SESSION_CHANGED');
  }
  return Object.freeze({ issue, requireMatch });
}

export function requireSameOrigin(requestOrigin, configuredOrigin) {
  let origin;
  try { origin = new URL(configuredOrigin); } catch { throw new AuthFenceError('ORIGIN_INVALID'); }
  if (origin.origin !== configuredOrigin || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && origin.hostname === 'localhost')) || origin.username || origin.password || requestOrigin !== configuredOrigin) {
    throw new AuthFenceError('ORIGIN_INVALID');
  }
}
