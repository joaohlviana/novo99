'use server';
import { serverSupabase, authOrigin } from '../../lib/supabase-server';
import { createAuthFence } from '../../lib/auth-fence.mjs';

export type AuthResult = { status: 'unavailable' | 'invalid' | 'signed-in' | 'check-email' | 'unknown' | 'signed-out' | 'changed' };
const invalid = (email:unknown,password:unknown) => typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128;
export async function signIn(email:string,password:string): Promise<AuthResult> {
  if (invalid(email,password)) return {status:'invalid'};
  try { const client=await serverSupabase(true); const {error}=await client.auth.signInWithPassword({email:email.trim(),password}); return {status:error?(error.code==='invalid_credentials'?'invalid':'unknown'):'signed-in'}; }
  catch { return {status:'unknown'}; }
}
export async function signUp(email:string,password:string,adult:boolean): Promise<AuthResult> {
  if (invalid(email,password) || adult !== true) return {status:'invalid'};
  const origin=authOrigin(); if (!origin) return {status:'unavailable'};
  try { const client=await serverSupabase(true); const {error,data}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${origin}/auth/callback`}}); if (error) return {status:'unknown'}; return {status:data.session?'signed-in':'check-email'}; }
  catch { return {status:'unknown'}; }
}
export async function signOut(expected:string): Promise<AuthResult> {
  try {
    const key=Buffer.from(process.env.AUTH_SESSION_FENCE_SECRET || '', 'utf8');
    const fence=createAuthFence(key);
    const client=await serverSupabase(true);
    const {data:usr,error}=await client.auth.getUser();
    const claims=await client.auth.getClaims();
    if (error || !usr.user || claims.error || !claims.data?.claims?.session_id) return {status:'changed'};
    fence.requireMatch({userId:usr.user.id,sessionId:claims.data.claims.session_id,authorizationRevision:0},expected);
    try { const result=await client.auth.signOut({scope:'local'}); return {status:result.error?'unknown':'signed-out'}; } catch { return {status:'unknown'}; }
  } catch { return {status:'changed'}; }
}
