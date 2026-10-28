import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverSupabase } from '../../../lib/supabase-server';
import { createAuthFence } from '../../../lib/auth-fence.mjs';
import { TrainerSession } from '../../../components/signup/TrainerSession';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Seu perfil | 99Coach', robots: { index: false, follow: false } };

export default async function TrainerPage() {
  let userId: string | null = null;
  let sessionId: string | null = null;
  let marker: string | null = null;
  try {
    const client = await serverSupabase(false);
    const { data, error } = await client.auth.getUser();
    const claims = await client.auth.getClaims();
    const sid = claims.data?.claims?.session_id;
    if (!error && data.user && !claims.error && claims.data?.claims?.sub === data.user.id && typeof sid === 'string') {
      userId = data.user.id;
      sessionId = sid;
      marker = createAuthFence(Buffer.from(process.env.AUTH_SESSION_FENCE_SECRET || '', 'utf8'))
        .issue({ userId, sessionId: sid, authorizationRevision: 0 });
    }
  } catch { /* Missing/invalid authentication must not show a private draft. */ }
  if (!userId || !sessionId || !marker) redirect('/entrar');
  return <TrainerSession key={marker} scope={marker} expectedUser={userId} expectedSession={sessionId} />;
}
