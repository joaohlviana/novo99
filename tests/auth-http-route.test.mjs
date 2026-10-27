import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';
import { createServerClient } from '@supabase/ssr';

// The actual handlers are transpiled unchanged except for module paths and the
// Next server-only configuration accessor. The Supabase SDK is real; all HTTP
// transport is synthetic and the real Next request/response classes are used.
const root = new URL('../', import.meta.url);
const options = {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}};
async function load(relative, rewrite) {
  const source = await readFile(new URL(relative, root), 'utf8');
  const js = rewrite(ts.transpileModule(source, options).outputText);
  const path = new URL(`./http-handler-${process.pid}-${Math.random().toString(36).slice(2)}.tmp.mjs`, import.meta.url);
  await writeFile(path, js);
  try { return await import(path.href); } finally { await unlink(path); }
}
const callback = await load('app/auth/callback/route.ts', js => js
  .replace("from 'next/server'", "from 'next/server.js'")
  .replace("from '../../../lib/pkce-callback.mjs'", "from '../lib/pkce-callback.mjs'")
  .replace("import { authOrigin } from '../../../lib/supabase-server';", "const authOrigin = () => process.env.AUTH_APP_ORIGIN || null;"));
const middleware = await load('proxy.ts', js => js
  .replace("from 'next/server'", "from 'next/server.js'")
  .replace("from './lib/config.mjs'", "from '../lib/config.mjs'"));
const base = 'https://preview.example.test';
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const response = value => new Response(JSON.stringify(value), {status:200,headers:{'content-type':'application/json'}});
const token = exp => ['e30', Buffer.from(JSON.stringify({sub:uid,session_id:'11111111-1111-4111-8111-111111111111',exp})).toString('base64url'), 'synthetic'].join('.');
const saved = { fetch:globalThis.fetch, url:process.env.NEXT_PUBLIC_SUPABASE_URL, key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, enabled:process.env.AUTH_SSR_ENABLED, origin:process.env.AUTH_APP_ORIGIN };
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://rycaxboqkkiopjdecgld.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
process.env.AUTH_APP_ORIGIN = base;
process.env.AUTH_SSR_ENABLED = 'true';
test.after(() => { globalThis.fetch=saved.fetch; for(const [key,value] of [['NEXT_PUBLIC_SUPABASE_URL',saved.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',saved.key],['AUTH_SSR_ENABLED',saved.enabled],['AUTH_APP_ORIGIN',saved.origin]]) { if(value === undefined) delete process.env[key]; else process.env[key]=value; } });
function jar() {
 const store=new Map();
 return {getAll:()=>[...store].map(([name,value])=>({name,value})),setAll(items){for(const {name,value,options} of items){if(options?.maxAge===0)store.delete(name);else store.set(name,value)}}};
}
const requestFor = (url,cookies=[]) => new NextRequest(url, {headers: cookies.length ? {cookie:cookies.map(({name,value})=>`${name}=${value}`).join('; ')} : {}});

test('callback uses real SDK PKCE exchange with Next response cookies and private headers', async () => {
 const cookies=jar(); let flow, exchanged=0;
 globalThis.fetch=async (url,opts)=>{
   const path=new URL(url);
   if(path.pathname.endsWith('/signup')) {flow=new URL(path.searchParams.get('redirect_to')).searchParams.get('sb_flow_id');return response({id:uid,email:'test@example.invalid'});}
   if(path.pathname.endsWith('/token')) {exchanged++;assert.ok(JSON.parse(opts.body).code_verifier);return response({access_token:token(Math.floor(Date.now()/1000)+3600),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:uid}});}
   if(path.pathname.endsWith('/user'))return response({id:uid});
   throw Error('unexpected synthetic request');
 };
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{experimental:{appendPkceFlowIdToRedirects:true}},cookies});
 assert.equal((await client.auth.signUp({email:'test@example.invalid',password:'synthetic-Password-123',options:{emailRedirectTo:`${base}/auth/callback`}})).error,null);
 assert.ok(flow);
 const result=await callback.GET(requestFor(`${base}/auth/callback?code=test-code&sb_flow_id=${flow}`,cookies.getAll()));
 assert.equal(result.status,303);assert.equal(result.headers.get('location'),`${base}/auth/confirmado`);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('referrer-policy'),'no-referrer');assert.equal(exchanged,1);
 const output=result.cookies.getAll(); assert.ok(output.some(c=>c.name.includes('auth-token'))); assert.ok(output.some(c=>c.name.includes('code-verifier')&&c.value===''));
});

test('callback unavailable or malformed returns no cookies and no-store',async()=>{
 process.env.AUTH_SSR_ENABLED='false';
 let result=await callback.GET(requestFor(`${base}/auth/callback?code=abc&sb_flow_id=flow12345`));assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.cookies.getAll().length,0);
 process.env.AUTH_SSR_ENABLED='true';
 globalThis.fetch=async()=>{throw Error('unexpected request')};
 result=await callback.GET(requestFor(`${base}/auth/callback?code=abc`));assert.equal(result.status,303);assert.equal(result.headers.get('location'),`${base}/auth/confirmado?estado=incerto`);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.cookies.getAll().length,0);
});

test('proxy fails closed for missing authentication without redirecting to an external origin',async()=>{
 globalThis.fetch=async()=>{throw Error('unexpected request')};
 const result=await middleware.proxy(requestFor(`${base}/painel`));
 assert.equal(result.status,307);assert.equal(result.headers.get('location'),`${base}/entrar`);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.cookies.getAll().length,0);
});

test('proxy validates a real SDK session via synthetic Auth user endpoint',async()=>{
 const cookies=jar();let userCalls=0;
 globalThis.fetch=async (url)=>{const path=new URL(url).pathname;if(path.endsWith('/token'))return response({access_token:token(Math.floor(Date.now()/1000)+3600),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:uid}});if(path.endsWith('/user')){userCalls++;return response({id:uid})}throw Error('unexpected request')};
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies});
 assert.equal((await client.auth.signInWithPassword({email:'test@example.invalid',password:'synthetic-password'})).error,null);
 assert.ok(cookies.getAll().length);
 const result=await middleware.proxy(requestFor(`${base}/painel`,cookies.getAll()));
 assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(userCalls,1);
});

test('proxy refreshes a near-expiry SDK session and returns updated cookies',async()=>{
 const cookies=jar();let refreshCalls=0,userCalls=0;
 globalThis.fetch=async url=>{
  const request=new URL(url);
  if(request.pathname.endsWith('/token')&&request.searchParams.get('grant_type')==='password')return response({access_token:token(Math.floor(Date.now()/1000)+1),refresh_token:'old-synthetic-refresh',token_type:'bearer',expires_in:1,user:{id:uid}});
  if(request.pathname.endsWith('/token')&&request.searchParams.get('grant_type')==='refresh_token'){refreshCalls++;return response({access_token:token(Math.floor(Date.now()/1000)+3600),refresh_token:'new-synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:uid}});}
  if(request.pathname.endsWith('/user')){userCalls++;return response({id:uid})}
  throw Error('unexpected request');
 };
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies});
 assert.equal((await client.auth.signInWithPassword({email:'test@example.invalid',password:'synthetic-password'})).error,null);
 const result=await middleware.proxy(requestFor(`${base}/painel`,cookies.getAll()));
 assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(refreshCalls,1);assert.equal(userCalls,1);
 assert.ok(result.cookies.getAll().some(c=>c.name.includes('auth-token')),'refreshed session must be written to the browser response');
});

test('proxy rejects a failed token refresh without forwarding synthetic provider details',async()=>{
 const cookies=jar();let refreshCalls=0;
 globalThis.fetch=async url=>{
  const request=new URL(url);
  if(request.pathname.endsWith('/token')&&request.searchParams.get('grant_type')==='password')return response({access_token:token(Math.floor(Date.now()/1000)+1),refresh_token:'old-synthetic-refresh',token_type:'bearer',expires_in:1,user:{id:uid}});
  if(request.pathname.endsWith('/token')&&request.searchParams.get('grant_type')==='refresh_token'){refreshCalls++;return new Response(JSON.stringify({error:'invalid_grant',error_description:'synthetic private provider detail'}),{status:400,headers:{'content-type':'application/json'}});}
  throw Error('unexpected request');
 };
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies});
 assert.equal((await client.auth.signInWithPassword({email:'test@example.invalid',password:'synthetic-password'})).error,null);
 const result=await middleware.proxy(requestFor(`${base}/painel`,cookies.getAll()));
 assert.equal(result.status,307);assert.equal(result.headers.get('location'),`${base}/entrar`);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(refreshCalls,1);
 assert.equal((await result.text()).includes('synthetic private provider detail'),false);
});
