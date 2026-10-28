import { redirect } from 'next/navigation';
import { serverSupabase } from '../../lib/supabase-server';
import { AccountSession } from '../../components/signup/AccountSession';
import { createAuthFence } from '../../lib/auth-fence.mjs';
export const dynamic = 'force-dynamic';
export default async function Painel() {
  let userId: string | null = null;
  let marker: string | null = null;
  let sessionId: string | null = null;
  try {
    const client = await serverSupabase(false);
    const { data, error } = await client.auth.getUser();
    const claims = await client.auth.getClaims();
    if (!error && data.user && !claims.error && claims.data?.claims?.sub === data.user.id && claims.data?.claims?.session_id) {
      userId = data.user.id;
      sessionId = String(claims.data.claims.session_id);
      marker = createAuthFence(Buffer.from(process.env.AUTH_SESSION_FENCE_SECRET || '', 'utf8')).issue({ userId, sessionId: claims.data.claims.session_id, authorizationRevision: 0 });
    }
  } catch { /* Fail closed if session validation or cookie refresh fails. */ }
  if (!userId || !marker || !sessionId) redirect('/entrar');
  return <AccountSession key={marker} expectedUser={userId} expectedSession={sessionId} />;
}
