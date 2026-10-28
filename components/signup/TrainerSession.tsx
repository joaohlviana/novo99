'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrainerOnboarding } from '../onboarding/TrainerOnboarding';
import { browserSupabase } from '../../lib/supabase-browser';
import { describeVerification } from '../../lib/browser-session.mjs';
import { shouldDiscardTrainerDraft } from '../../lib/trainer-session-event.mjs';

/** A scoped UI draft only. No lookup, location resolver or persistence is connected. */
export function TrainerSession({ scope, expectedUser, expectedSession }: { scope: string; expectedUser: string; expectedSession: string }) {
  const router = useRouter();
  const serial = useRef(0);
  const discarded = useRef(false);
  const draftRoot = useRef<HTMLDivElement>(null);
  const focusToRestore = useRef<HTMLElement | null>(null);
  const focusWasMoved = useRef(false);
  const [ready, setReady] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof browserSupabase>;
    try { client = browserSupabase(); }
    catch { setMessage('Não foi possível verificar a sessão.'); return; }
    function verify() {
      const ticket = ++serial.current;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && draftRoot.current?.contains(focused)) {
        focusToRestore.current = focused;
        focusWasMoved.current = false;
      }
      // Keep the draft mounted but inaccessible while checking: a same-session
      // refresh preserves it; a new server scope remounts it after refresh.
      setReady(false); setMessage('');
      setTimeout(async () => {
        try {
          const user = await client.auth.getUser();
          const claims = await client.auth.getClaims();
          if (!active || ticket !== serial.current) return;
          const result = describeVerification(user, claims, expectedUser, expectedSession);
          if (result.status !== 'verified') {
            setMessage(result.status === 'changed' ? 'A sessão mudou. Confira sua conta.' : 'Não foi possível verificar a sessão.');
            if (result.status === 'changed') { discarded.current = true; setRemoved(true); router.refresh(); }
            return;
          }
          if (!discarded.current) setReady(true);
        } catch {
          if (active && ticket === serial.current) setMessage('Não foi possível verificar a sessão.');
        }
      }, 0);
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (shouldDiscardTrainerDraft(event, session, expectedUser, expectedSession)) {
        discarded.current = true; setRemoved(true);
      }
      verify();
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') router.refresh();
    });
    function recheckVisible() {
      if (document.visibilityState === 'visible') verify();
    }
    function noteUserInput() { focusWasMoved.current = true; }
    window.addEventListener('focus', recheckVisible);
    document.addEventListener('visibilitychange', recheckVisible);
    window.addEventListener('pointerdown', noteUserInput, true);
    window.addEventListener('keydown', noteUserInput, true);
    verify();
    return () => { active = false; serial.current++; subscription.unsubscribe(); window.removeEventListener('focus', recheckVisible); document.removeEventListener('visibilitychange', recheckVisible); window.removeEventListener('pointerdown', noteUserInput, true); window.removeEventListener('keydown', noteUserInput, true); };
  }, [expectedUser, expectedSession, router]);

  useEffect(() => {
    if (!ready || !focusToRestore.current || focusWasMoved.current) return;
    const previous = focusToRestore.current;
    focusToRestore.current = null;
    const frame = requestAnimationFrame(() => {
      if (!focusWasMoved.current && document.activeElement === document.body && previous.isConnected) previous.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  return <>
    {!ready && <div role={message ? 'alert' : 'status'} className="main">{message || 'Verificando sessão…'}{message && <> <a href="/onboarding/treinador">Verificar sessão</a></>}</div>}
    {!removed && <div ref={draftRoot} hidden={!ready}><TrainerOnboarding sessionScope={scope} /></div>}
  </>;
}
