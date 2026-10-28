import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserClient } from '@supabase/ssr';

// The SDK is real; network and cookie storage are synthetic. No account is created.
test('browser SDK signup, login and local logout use the shared cookie storage', async () => {
 const jar=new Map(), calls=[];
 const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const token=`e30.${Buffer.from(JSON.stringify({sub:uid,session_id:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic`;
 const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
 const fetcher=async (address,options)=>{const path=new URL(address).pathname;calls.push(path);
  if(path.endsWith('/signup'))return json({user:{id:uid},session:null});
  if(path.endsWith('/token'))return json({access_token:token,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:uid}});
  if(path.endsWith('/logout'))return new Response(null,{status:204});
  throw new Error('unexpected synthetic endpoint');};
 const client=createBrowserClient('https://example.supabase.co','sb_publishable_test',{isSingleton:false,auth:{autoRefreshToken:false,detectSessionInUrl:false,experimental:{appendPkceFlowIdToRedirects:true}},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>{for(const item of items)if(item.options?.maxAge===0)jar.delete(item.name);else jar.set(item.name,item.value)}},global:{fetch:fetcher}});
 const signUp=await client.auth.signUp({email:'synthetic@example.test',password:'synthetic-password',options:{emailRedirectTo:'https://preview.example.test/auth/callback'}});
 assert.equal(signUp.error,null);assert.equal(signUp.data.session,null);assert.ok(calls.includes('/auth/v1/signup'));
 const login=await client.auth.signInWithPassword({email:'synthetic@example.test',password:'synthetic-password'});assert.equal(login.error,null);assert.equal(login.data.user.id,uid);
 const logout=await client.auth.signOut({scope:'local'});assert.equal(logout.error,null);assert.ok(calls.includes('/auth/v1/logout'));
 const session=await client.auth.getSession();assert.equal(session.data.session,null);
});
