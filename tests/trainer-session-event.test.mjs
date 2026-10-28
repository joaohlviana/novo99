import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDiscardTrainerDraft } from '../lib/trainer-session-event.mjs';
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sid='11111111-1111-4111-8111-111111111111';
const session=(sub=user,sessionId=sid,owner=user)=>({user:{id:owner},access_token:`e30.${Buffer.from(JSON.stringify({sub,session_id:sessionId})).toString('base64url')}.synthetic`});
test('same-session events retain draft while account, session replacement and logout discard',()=>{
  assert.equal(shouldDiscardTrainerDraft('TOKEN_REFRESHED',session(),user,sid),false);
  assert.equal(shouldDiscardTrainerDraft('SIGNED_IN',session(),user,sid),false);
  assert.equal(shouldDiscardTrainerDraft('SIGNED_IN',session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',sid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),user,sid),true);
  assert.equal(shouldDiscardTrainerDraft('SIGNED_IN',session(user,'22222222-2222-4222-8222-222222222222'),user,sid),true);
  assert.equal(shouldDiscardTrainerDraft('SIGNED_OUT',null,user,sid),true);
});
test('malformed or missing initial event fails closed; same event data never authorizes',()=>{
  assert.equal(shouldDiscardTrainerDraft('INITIAL_SESSION',null,user,sid),true);
  assert.equal(shouldDiscardTrainerDraft('SIGNED_IN',{user:{id:user},access_token:'bad'},user,sid),true);
  assert.equal(shouldDiscardTrainerDraft('SIGNED_IN',session('not-expected'),user,sid),true);
});
