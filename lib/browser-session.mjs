// One shared browser session. This check reduces stale logout mistakes but the
// cookie may still change between verification and the SDK effect.
export async function signOutExpected(client, expectedUser, expectedSession) {
  try {
    const {data, error} = await client.auth.getUser();
    const claims = await client.auth.getClaims();
    if (error || claims.error || !data.user || data.user.id !== expectedUser || claims.data?.claims?.sub !== data.user.id || claims.data?.claims?.session_id !== expectedSession) return 'changed';
    const result = await client.auth.signOut({scope:'local'});
    return result.error ? 'unknown' : 'signed-out';
  } catch { return 'unknown'; }
}

// Only called with results from SDK getUser + getClaims for this browser.
export function verifiedIdentity(userResult, claimsResult, expectedUser, expectedSession) {
  const user = userResult?.data?.user;
  if (userResult?.error || claimsResult?.error || !user || user.id !== expectedUser || claimsResult?.data?.claims?.sub !== user.id || claimsResult?.data?.claims?.session_id !== expectedSession) return null;
  return { email: typeof user.email === 'string' ? user.email : null };
}

export function describeVerification(userResult, claimsResult, expectedUser, expectedSession) {
  const identity = verifiedIdentity(userResult, claimsResult, expectedUser, expectedSession);
  if (identity) return { status: 'verified', identity };
  return { status: userResult?.error || claimsResult?.error ? 'unavailable' : 'changed', identity: null };
}
