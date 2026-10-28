// Untrusted event data may only discard a draft, never authorize it. The actual
// rendering gate always verifies getUser/getClaims against the server scope.
export function shouldDiscardTrainerDraft(event, session, expectedUser, expectedSession) {
  if (event === 'SIGNED_OUT') return true;
  if (!session) return event === 'INITIAL_SESSION';
  if (session.user?.id !== expectedUser || typeof session.access_token !== 'string') return true;
  try {
    const parts = session.access_token.split('.');
    if (parts.length !== 3) return true;
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return payload.sub !== expectedUser || payload.session_id !== expectedSession;
  } catch { return true; }
}
