import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual Server Action implementation with a per-test Auth double;
// this does not prove provider, browser cookies or cross-tab concurrency.
const source=await readFile(new URL('../app/auth/actions.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
 .replace("import { serverSupabase, authOrigin } from '../../lib/supabase-server';", "const serverSupabase = () => globalThis.__testClient(); const authOrigin = () => 'https://preview.example.test';")
 .replace("import { createAuthFence } from '../../lib/auth-fence.mjs';", "import { createAuthFence } from '../lib/auth-fence.mjs';");
const temp=new URL(`./actions-${process.pid}.tmp.mjs`,import.meta.url);await writeFile(temp,compiled);
let actions;try{actions=await import(temp.href)}finally{await unlink(temp)}

test('sign in distinguishes invalid credentials from unknown provider outcome',async()=>{
 globalThis.__testClient=async()=>({auth:{signInWithPassword:async()=>({error:{code:'invalid_credentials'}})}});
 assert.equal((await actions.signIn('test@example.test','123456789012')).status,'invalid');
 globalThis.__testClient=async()=>({auth:{signInWithPassword:async()=>({error:{code:'unexpected_failure'}})}});
 assert.equal((await actions.signIn('test@example.test','123456789012')).status,'unknown');
 globalThis.__testClient=async()=>({auth:{signInWithPassword:async()=>{throw Error('synthetic failure')}}});
 assert.equal((await actions.signIn('test@example.test','123456789012')).status,'unknown');
});
test('signup sends one request and never repeats after unknown response',async()=>{
 let calls=0;globalThis.__testClient=async()=>({auth:{signUp:async()=>{calls++;throw Error('synthetic loss')}}});
 assert.equal((await actions.signUp('test@example.test','123456789012',true)).status,'unknown');assert.equal(calls,1);
 assert.equal((await actions.signUp('test@example.test','123456789012',false)).status,'invalid');assert.equal(calls,1);
});
test('signup pending confirmation reports check-email',async()=>{
 globalThis.__testClient=async()=>({auth:{signUp:async()=>({error:null,data:{session:null}})}});
 assert.equal((await actions.signUp('test@example.test','123456789012',true)).status,'check-email');
});
test('sign out rejects a changed cookie identity before touching the provider',async()=>{
 const {createAuthFence}=await import('../lib/auth-fence.mjs'); const secret='s'.repeat(32);const previous=process.env.AUTH_SESSION_FENCE_SECRET;process.env.AUTH_SESSION_FENCE_SECRET=secret;
 const a={userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionId:'11111111-1111-4111-8111-111111111111',authorizationRevision:0};
 let calls=0;globalThis.__testClient=async()=>({auth:{getUser:async()=>({data:{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}},error:null}),getClaims:async()=>({data:{claims:{session_id:'22222222-2222-4222-8222-222222222222'}},error:null}),signOut:async()=>{calls++;return {error:null}}}});
 try {assert.equal((await actions.signOut(createAuthFence(Buffer.from(secret)).issue(a))).status,'changed');assert.equal(calls,0);} finally {if(previous===undefined)delete process.env.AUTH_SESSION_FENCE_SECRET;else process.env.AUTH_SESSION_FENCE_SECRET=previous;}
});
test('lost sign out response remains unknown and is not retried',async()=>{
 const {createAuthFence}=await import('../lib/auth-fence.mjs');const secret='s'.repeat(32);const previous=process.env.AUTH_SESSION_FENCE_SECRET;process.env.AUTH_SESSION_FENCE_SECRET=secret;
 const a={userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionId:'11111111-1111-4111-8111-111111111111',authorizationRevision:0};let calls=0;
 globalThis.__testClient=async()=>({auth:{getUser:async()=>({data:{user:{id:a.userId}},error:null}),getClaims:async()=>({data:{claims:{session_id:a.sessionId}},error:null}),signOut:async()=>{calls++;throw Error('synthetic loss')}}});
 try {assert.equal((await actions.signOut(createAuthFence(Buffer.from(secret)).issue(a))).status,'unknown');assert.equal(calls,1);} finally {if(previous===undefined)delete process.env.AUTH_SESSION_FENCE_SECRET;else process.env.AUTH_SESSION_FENCE_SECRET=previous;}
});
