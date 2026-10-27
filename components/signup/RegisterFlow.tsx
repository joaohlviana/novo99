'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterForm, type RegisterDraft, type RegisterStatus } from './RegisterForm';
import { signUp } from '../../app/auth/actions';

export function RegisterFlow(){
 const busy=useRef(false); const [status,setStatus]=useState<RegisterStatus>('idle'); const router=useRouter();
 async function submit(draft:RegisterDraft){
  if(busy.current)return;busy.current=true;setStatus('pending');
  try { const result=await signUp(draft.email,draft.password,draft.adult);
    if(result.status==='signed-in'){router.replace('/painel');return;}
    setStatus(result.status==='check-email'?'check-email':result.status==='unknown'?'unconfirmed':'error');
  } catch {setStatus('unconfirmed');} finally {busy.current=false;}
 }
 return <RegisterForm onSubmit={submit} status={status} identityOnly/>;
}
