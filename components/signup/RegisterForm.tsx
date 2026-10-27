'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { hasAdultConsent } from './register-validation.mjs';

export type RegisterDraft = { name: string; email: string; password: string; adult: true; initialRole: 'trainer' | 'student' };
export type RegisterStatus = 'idle' | 'pending' | 'check-email' | 'unconfirmed' | 'error';

/** Presentation only. A caller must provide the reviewed session-scoped action; no provider is called here. */
export function RegisterForm({ onSubmit, status = 'idle', identityOnly = false }: { onSubmit?: (draft: RegisterDraft) => void; status?: RegisterStatus; identityOnly?: boolean }) {
  const [role, setRole] = useState<'trainer' | 'student'>('trainer');
  const [mismatch, setMismatch] = useState(false);
  const [adultMissing, setAdultMissing] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const clearPassword = status === 'check-email' || status === 'unconfirmed';
  useEffect(() => { if (clearPassword) { setPassword(''); setConfirmation(''); setMismatch(false); } }, [clearPassword]);
  const pending = status === 'pending';
  const enabled = !!onSubmit && !pending && status !== 'check-email' && status !== 'unconfirmed';
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || !onSubmit) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    if (!hasAdultConsent(values)) { setAdultMissing(true); return; }
    setAdultMissing(false);
    if (password !== confirmation) { setMismatch(true); return; }
    setMismatch(false);
    onSubmit({ name: String(values.get('name') ?? '').trim(), email: String(values.get('email') ?? '').trim(), password, adult: true, initialRole: role });
  }
  return <main id="main" className="register-shell">
    <header className="register-header"><a href="/" className="register-back" aria-label="Voltar ao início">←</a><a href="/" aria-label="99Coach, início"><img src="/logo.svg" alt="99Coach" width="114" height="28" /></a></header>
    <section className="register-card" aria-labelledby="register-heading">
      <div className="register-heading"><p className="register-eyebrow">{identityOnly ? '99COACH' : role === 'trainer' ? 'TREINADOR' : 'ALUNO'}</p><h1 id="register-heading">{identityOnly ? 'CRIE SUA CONTA' : role === 'trainer' ? 'CRIE SUA CONTA DE TREINADOR' : 'CRIE SUA CONTA DE ALUNO'}</h1><p>{identityOnly ? 'Após confirmar seu e-mail, você poderá completar seu perfil quando o onboarding estiver disponível.' : 'Crie sua conta para começar.'}</p></div>
      <form onSubmit={submit}>
        {!identityOnly && <><label className="register-field">Nome<input name="name" autoComplete="name" required minLength={2} maxLength={120} disabled={!enabled} /></label>
        <fieldset className="register-field"><legend>Como você quer começar?</legend><div className="register-roles">{(['trainer','student'] as const).map(value=><label key={value}><input type="radio" name="role" value={value} checked={role === value} onChange={()=>setRole(value)} disabled={!enabled}/><span>{value === 'trainer' ? 'Treinador' : 'Aluno'}</span></label>)}</div></fieldset></>}
        <label className="register-field">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={!enabled} /></label>
        <div className="register-field"><label htmlFor="register-password">Senha</label><input id="register-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="register-password-hint" disabled={!enabled} value={clearPassword ? '' : password} onChange={e=>{setPassword(e.target.value);setMismatch(false);}}/><p id="register-password-hint" className="register-hint">Use pelo menos 12 caracteres.</p></div>
        <div className="register-field"><label htmlFor="register-confirmation">Confirme sua senha</label><input id="register-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? 'register-mismatch' : undefined} disabled={!enabled} value={clearPassword ? '' : confirmation} onChange={e=>{setConfirmation(e.target.value);setMismatch(false);}}/>{mismatch && <p id="register-mismatch" className="register-error" role="alert">As senhas não coincidem.</p>}</div>
        <label className="register-consent"><input type="checkbox" name="adult" required disabled={!enabled} aria-invalid={adultMissing || undefined} aria-describedby={adultMissing ? 'register-adult-error' : undefined} onChange={()=>setAdultMissing(false)}/> Declaro que tenho 18 anos ou mais.</label>{identityOnly && <p className="register-hint">Esta declaração será solicitada novamente ao completar o perfil.</p>}{adultMissing && <p id="register-adult-error" className="register-error" role="alert">Confirme que você tem 18 anos ou mais.</p>}
        <div role="status" aria-live="polite">{status === 'pending' ? 'Enviando cadastro…' : status === 'check-email' ? 'Confira seu e-mail e abra o link neste mesmo navegador para confirmar o cadastro.' : status === 'unconfirmed' ? 'Não foi possível confirmar o resultado. Confira seu e-mail antes de tentar novamente.' : ''}</div>
        {status === 'error' && <p className="register-error" role="alert">Não foi possível concluir o cadastro. Confira os dados e tente novamente.</p>}
        {!onSubmit && <p className="register-hint">Cadastro temporariamente indisponível.</p>}
        <button className="register-primary" type="submit" disabled={!enabled}>Criar conta <span aria-hidden="true">→</span></button>
      </form>
      <button className="register-google" type="button" disabled>Continuar com Google</button><p className="register-hint">Google temporariamente indisponível.</p>
    </section>
  </main>;
}
