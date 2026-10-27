import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangePkceCallback, parsePkceCallback } from '../lib/pkce-callback.mjs';

const origin = 'https://preview.example.test';
const url = `${origin}/auth/callback?code=synthetic-code&sb_flow_id=flow_12345`;
const env = { NEXT_PUBLIC_SUPABASE_URL:'https://rycaxboqkkiopjdecgld.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test' };
const requestCookies = [{name:'verifier',value:'synthetic-a'}];
function fake({fail, wrongUser, seen}={}) {
 return (_url,_key,{cookies})=>({auth:{
  async exchangeCodeForSession(code,options) {
   seen?.push({code,options,cookies:cookies.getAll()});
   cookies.setAll([{name:'session',value:'synthetic-session',options:{httpOnly:true}}],{'Expires':'0'});
   if(fail==='throw') throw Error('sensitive provider error');
   return fail==='exchange' ? {error:{message:'secret'}} : {data:{session:{},user:{id:'A'}}};
  },
  async getUser() {return fail==='user' ? {error:{message:'secret'}} : {data:{user:{id:wrongUser?'B':'A'}}};}
 }});
}
test('rejects wrong origins, duplicate codes, errors and malformed flow ids',()=>{
 for(const input of [url.replace(origin,'https://evil.test'),`${url}&code=other`,`${url}&error=denied`,`${origin}/auth/callback?code=x&sb_flow_id=x%2Fy`,`${origin}/other?code=x`,`${origin}/auth/callback?code=x`,`${url}&sb_flow_id=duplicate`]) assert.equal(parsePkceCallback(input,origin),null);
 assert.equal(parsePkceCallback(url,'https://preview.example.test/path'),null);
});
test('forwards flow ID and request-scoped verifier; redirect is fixed and non-cacheable',async()=>{
 const seen=[]; const result=await exchangePkceCallback({rawUrl:`${url}&next=https://evil.test`,configuredOrigin:origin,env,requestCookies,makeClient:fake({seen})});
 assert.equal(result.ok,true); assert.equal(result.redirect,`${origin}/auth/confirmado`); assert.equal(result.headers['cache-control'],'private, no-store');
 assert.deepEqual(seen,[{code:'synthetic-code',options:{flowId:'flow_12345'},cookies:requestCookies}]); assert.equal(result.cookies[0].name,'session');
});
test('exchange or verification failure never returns staged cookies or raw provider errors',async()=>{
 for (const opts of [{fail:'throw'},{fail:'exchange'},{fail:'user'},{wrongUser:true}]) {
  const result=await exchangePkceCallback({rawUrl:url,configuredOrigin:origin,env,requestCookies,makeClient:fake(opts)});
  assert.equal(result.ok,false); assert.equal(result.reason,'unconfirmed'); assert.equal(result.headers['cache-control'],'private, no-store'); assert.equal(result.headers['referrer-policy'],'no-referrer'); assert.equal('cookies' in result,false);
 }
});
test('separate requests cannot share staged cookies or cookie inputs',async()=>{
 const seenA=[],seenB=[];
 const args={rawUrl:url,configuredOrigin:origin,env};
 const [a,b]=await Promise.all([
  exchangePkceCallback({...args,requestCookies:[{name:'verifier',value:'A'}],makeClient:fake({seen:seenA})}),
  exchangePkceCallback({...args,requestCookies:[{name:'verifier',value:'B'}],makeClient:fake({seen:seenB})})
 ]);
 assert.equal(seenA[0].cookies[0].value,'A'); assert.equal(seenB[0].cookies[0].value,'B'); assert.notEqual(a.cookies,b.cookies);
});

test('invalid input also returns cache and referrer restrictions without cookies',async()=>{
 const result=await exchangePkceCallback({rawUrl:`${origin}/auth/callback?code=x`,configuredOrigin:origin,env,requestCookies,makeClient:()=>{throw Error('must not execute')}});
 assert.equal(result.reason,'invalid'); assert.equal(result.headers['cache-control'],'private, no-store'); assert.equal(result.headers['referrer-policy'],'no-referrer'); assert.equal('cookies' in result,false);
});
