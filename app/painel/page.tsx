import { redirect } from 'next/navigation';
import { serverSupabase } from '../../lib/supabase-server';
import { createAuthFence } from '../../lib/auth-fence.mjs';
import { signOut } from '../auth/actions';
export const dynamic='force-dynamic';
export default async function Painel(){
 let marker='';
 try { const client=await serverSupabase(false); const {data,error}=await client.auth.getUser(); const claims=await client.auth.getClaims();
  if(error || !data.user || claims.error || !claims.data?.claims?.session_id) redirect('/entrar');
  marker=createAuthFence(Buffer.from(process.env.AUTH_SESSION_FENCE_SECRET || '', 'utf8')).issue({userId:data.user.id,sessionId:claims.data.claims.session_id,authorizationRevision:0});
 } catch { redirect('/entrar'); }
 async function sair(){'use server'; const result=await signOut(marker); if(result.status==='signed-out') redirect('/entrar'); redirect('/entrar?estado=incerto'); }
 return <main id="main" className="main"><h1>MINHA CONTA</h1><p>O onboarding e os demais módulos ainda estão em preparação.</p><form action={sair}><button type="submit">Sair</button></form></main>;
}
