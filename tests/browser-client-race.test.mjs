import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserClient } from '@supabase/ssr';

// SDK is real. Cookie jar, requests and two tab clients are synthetic; this is
// not a browser or Supabase integration test. Explicitly force non-singleton for
// the two-client case to model separate tabs sharing a cookie jar.
const host='https://example.supabase.co';
const uid={A:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
const jwt=id=>`e30.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic`;
const response=id=>new Response(JSON.stringify({access_token:jwt(id),refresh_token:'synthetic-'+id,token_type:'bearer',expires_in:3600,user:{id}}),{status:200,headers:{'content-type':'application/json'}});
function make(jar,fetcher){return createBrowserClient(host,'sb_publishable_test',{isSingleton:false,auth:{autoRefreshToken:false,detectSessionInUrl:false},cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:items=>{for(const i of items)if(i.options?.maxAge===0)jar.delete(i.name);else jar.set(i.name,i.value)}},global:{fetch:fetcher}})}
async function scenario(twoClients){
 let releaseA, startA;const delay=new Promise(resolve=>releaseA=resolve), started=new Promise(resolve=>startA=resolve);
 const jar=new Map();const fetcher=async (_url,opts)=>{const email=JSON.parse(opts.body).email;if(email==='a@example.test'){startA();await delay;return response(uid.A)}return response(uid.B)};
 const a=make(jar,fetcher),b=twoClients?make(jar,fetcher):a;
 const delayed=a.auth.signInWithPassword({email:'a@example.test',password:'syntheticPassword1!'});await started;
 const second=await b.auth.signInWithPassword({email:'b@example.test',password:'syntheticPassword1!'});assert.equal(second.data.user.id,uid.B);
 releaseA();const first=await delayed;assert.equal(first.data.user.id,uid.A);
 const observed=await b.auth.getSession();assert.equal(observed.data.session.user.id,uid.A);
}
test('browser SDK concurrent sign-ins in one client can apply older completion last',()=>scenario(false));
test('browser SDK concurrent sign-ins in separate clients sharing cookies can apply older completion last',()=>scenario(true));
