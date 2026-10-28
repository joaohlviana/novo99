'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterForm, type RegisterDraft, type RegisterStatus } from './RegisterForm';
import { browserSupabase } from '../../lib/supabase-browser';
import { signupErrorState } from './signup-result.mjs';

export function RegisterFlow({ callbackOrigin }: { callbackOrigin: string }){
 const busy=useRef(false); const [status,setStatus]=useState<RegisterStatus>('idle'); const router=useRouter();
 async function submit(draft:RegisterDraft){
  if(busy.current)return;busy.current=true;setStatus('pending');
  try { if(!draft.adult){setStatus('error');return;}
    const {data,error}=await browserSupabase().auth.signUp({email:draft.email.trim(),password:draft.password,options:{emailRedirectTo:`${callbackOrigin}/auth/callback`}});
    if(error){setStatus(signupErrorState(error));return;}
    if(data.session){router.replace('/painel');router.refresh();return;}
    setStatus('check-email');
  } catch {setStatus('unconfirmed');} finally {busy.current=false;}
 }
 return <RegisterForm onSubmit={submit} status={status} identityOnly/>;
}
