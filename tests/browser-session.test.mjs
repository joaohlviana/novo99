import test from 'node:test';
import assert from 'node:assert/strict';
import {signOutExpected} from '../lib/browser-session.mjs';
function fake(user,session,result={error:null}) {let calls=0;return {auth:{getUser:async()=>({data:{user:{id:user}},error:null}),getClaims:async()=>({data:{claims:{sub:user,session_id:session}},error:null}),signOut:async()=>{calls++;return result}},calls:()=>calls};}
test('rejects logout if the effective account or session differs',async()=>{for(const [user,session] of [['B','S1'],['A','S2']]){const c=fake(user,session);assert.equal(await signOutExpected(c,'A','S1'),'changed');assert.equal(c.calls(),0);}});
test('logout runs once only after a match and classifies errors as unknown',async()=>{let c=fake('A','S1');assert.equal(await signOutExpected(c,'A','S1'),'signed-out');assert.equal(c.calls(),1);c=fake('A','S1',{error:{code:'synthetic'}});assert.equal(await signOutExpected(c,'A','S1'),'unknown');assert.equal(c.calls(),1);});

test('only the currently verified account and session provide displayed identity', async()=>{
 const {verifiedIdentity}=await import('../lib/browser-session.mjs');
 const u={data:{user:{id:'A',email:'synthetic@example.test'}},error:null};
 const c={data:{claims:{sub:'A',session_id:'S1'}},error:null};
 assert.deepEqual(verifiedIdentity(u,c,'A','S1'),{email:'synthetic@example.test'});
 assert.equal(verifiedIdentity(u,c,'B','S1'),null);
 assert.equal(verifiedIdentity(u,c,'A','S2'),null);
 assert.equal(verifiedIdentity({...u,error:{message:'synthetic'}},c,'A','S1'),null);
});

test('rejects mismatched subject in verified claims', async()=>{const {verifiedIdentity}=await import('../lib/browser-session.mjs');const u={data:{user:{id:'A',email:'synthetic@example.test'}},error:null};const c={data:{claims:{sub:'B',session_id:'S1'}},error:null};assert.equal(verifiedIdentity(u,c,'A','S1'),null);});

test('session verification failures are distinct from a changed identity and allow explicit recheck', async()=>{
 const {describeVerification}=await import('../lib/browser-session.mjs');
 const user={data:{user:{id:'A',email:'synthetic@example.test'}},error:null};
 const claims={data:{claims:{sub:'A',session_id:'S1'}},error:null};
 assert.equal(describeVerification({...user,error:{code:'network'}},claims,'A','S1').status,'unavailable');
 assert.equal(describeVerification(user,claims,'B','S1').status,'changed');
 assert.equal(describeVerification(user,claims,'A','S1').status,'verified');
});
