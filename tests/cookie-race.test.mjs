import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';

// Real installed Supabase SSR SDK; all provider traffic and browser cookie
// application are simulated. This isolates concurrent Set-Cookie ordering,
// not a real browser, Next deployment or Supabase provider validation.
const url='https://example.supabase.co';
const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sid = user => user === userA ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222';
const token = user => `e30.${Buffer.from(JSON.stringify({sub:user,session_id:sid(user),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic`;
const response = user => new Response(JSON.stringify({access_token:token(user),refresh_token:`synthetic-${user}`,token_type:'bearer',expires_in:3600,user:{id:user}}),{status:200,headers:{'content-type':'application/json'}});
const apply = (jar,writes) => { for(const {name,value,options} of writes) { if(options?.maxAge===0) jar.delete(name); else jar.set(name,value); } };
const input = jar => [...jar].map(([name,value])=>({name,value}));
function client(jar, fetcher, writes) {return createServerClient(url,'sb_publishable_synthetic',{cookies:{getAll:()=>input(jar),setAll:items=>writes.push(...items)},global:{fetch:fetcher}});}

test('late response from A can overwrite B in a simulated shared cookie jar',async()=>{
 let releaseA; const waitA=new Promise(resolve=>releaseA=resolve);
 const startJar=new Map(); const writesA=[],writesB=[];
 const a=client(startJar,async()=>{await waitA;return response(userA)},writesA);
 const b=client(startJar,async()=>response(userB),writesB);
 const promiseA=a.auth.signInWithPassword({email:'a@example.test',password:'syntheticPassword1!'});
 const resultB=await b.auth.signInWithPassword({email:'b@example.test',password:'syntheticPassword1!'});
 assert.equal(resultB.data.user?.id,userB); assert.ok(writesB.length);
 const browserJar=new Map();apply(browserJar,writesB);
 releaseA();const resultA=await promiseA;assert.equal(resultA.data.user?.id,userA);assert.ok(writesA.length);apply(browserJar,writesA);
 const inspect=client(browserJar,async()=>{throw Error('unexpected network')},[]);
 const observed=await inspect.auth.getSession();
 assert.equal(observed.data.session?.user?.id,userA, 'late Set-Cookie from A replaces B');
});

