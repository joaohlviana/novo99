'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '../../lib/supabase-browser';
import { signOutExpected, describeVerification } from '../../lib/browser-session.mjs';

// The server verified this account. Do not show private state while the browser
// is reconciling the current shared session after an auth notification.
export function AccountSession({ expectedUser, expectedSession }: { expectedUser: string; expectedSession: string }) {
  const router = useRouter();
  const serial = useRef(0);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof browserSupabase>;
    try { client = browserSupabase(); } catch { setNotice('Não foi possível verificar a sessão.'); return; }
    function reconcile() {
      const ticket = ++serial.current;
      setReady(false); setEmail(null); setNotice('');
      // Auth callbacks must not await another auth operation synchronously.
      setTimeout(async () => {
        try {
          const user = await client.auth.getUser();
          const claims = await client.auth.getClaims();
          if (!active || ticket !== serial.current) return;
          const result = describeVerification(user, claims, expectedUser, expectedSession);
          if (result.status !== 'verified') { setNotice(result.status === 'unavailable' ? 'Não foi possível verificar a sessão.' : 'A sessão mudou. Confira sua conta.'); return; }
          setEmail(result.identity?.email ?? null); setReady(true);
        } catch { if (active && ticket === serial.current) { setReady(false); setNotice('Não foi possível verificar a sessão.'); } }
      }, 0);
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      // Server refresh obtains a fresh session marker; React's key resets drafts
      // when the same person signs in with a replacement session.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') router.refresh();
      reconcile();
    });
    function recheckVisible() {
      if (document.visibilityState === 'visible') { reconcile(); router.refresh(); }
    }
    window.addEventListener('focus', recheckVisible);
    document.addEventListener('visibilitychange', recheckVisible);
    reconcile();
    return () => { active = false; ++serial.current; subscription.unsubscribe(); window.removeEventListener('focus', recheckVisible); document.removeEventListener('visibilitychange', recheckVisible); };
  }, [expectedUser, expectedSession, router]);
  async function signOut() {
    if (pending) return;
    setPending(true); setReady(false); setEmail(null); setNotice('');
    try {
      const result = await signOutExpected(browserSupabase(), expectedUser, expectedSession);
      if (result !== 'signed-out') { setNotice(result === 'changed' ? 'A sessão mudou. Confira sua conta antes de sair.' : 'Não foi possível confirmar a saída. Confira sua sessão antes de tentar novamente.'); router.refresh(); return; }
      router.replace('/entrar'); router.refresh();
    } catch { setNotice('Não foi possível confirmar a saída. Confira sua sessão antes de tentar novamente.'); }
    finally { setPending(false); }
  }
  return <main id="main" className="main"><h1>MINHA CONTA</h1>
    {!ready ? (!notice && <p role="status">Verificando sessão…</p>) : <><p>{email ? `Conta: ${email}` : 'Conta autenticada'}</p><p>O onboarding e os demais módulos ainda estão em preparação.</p><button type="button" disabled={pending} onClick={signOut}>Sair</button></>}
    {notice && <><p role="alert">{notice}</p><a href="/painel">Verificar sessão</a></>}
  </main>;
}
