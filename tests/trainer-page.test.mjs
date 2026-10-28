import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual server page with synthetic Auth responses. No provider,
// browser, mutation or database is contacted by these tests.
const source = await readFile(new URL('../app/onboarding/treinador/page.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  .replace("import { redirect } from 'next/navigation';", "const redirect = path => { throw new Error('redirect:' + path); };")
  .replace("import { serverSupabase } from '../../../lib/supabase-server';", "const serverSupabase = (...args) => globalThis.__trainerClient(...args);")
  .replace("import { createAuthFence } from '../../../lib/auth-fence.mjs';", "import { createAuthFence } from '../lib/auth-fence.mjs';")
  .replace("import { TrainerSession } from '../../../components/signup/TrainerSession';", "const TrainerSession = () => null;");
const temp = new URL(`./trainer-page-${process.pid}.tmp.mjs`, import.meta.url);
await writeFile(temp, code);
let page;
try { page = await import(temp.href); } finally { await unlink(temp); }
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sid='11111111-1111-4111-8111-111111111111';
const previousSecret = process.env.AUTH_SESSION_FENCE_SECRET;
process.env.AUTH_SESSION_FENCE_SECRET = 'fixture-secret-with-at-least-thirty-two-bytes';
test.after(() => { if (previousSecret === undefined) delete process.env.AUTH_SESSION_FENCE_SECRET; else process.env.AUTH_SESSION_FENCE_SECRET = previousSecret; delete globalThis.__trainerClient; });
function fixture({user=uid, subject=uid, session=sid, fail=false}={}) {
  return async writable => {
    assert.equal(writable, false, 'server component must not write cookies');
    if (fail) throw new Error('synthetic provider failure');
    return {auth:{ getUser:async()=>({data:{user:user ? {id:user}:null},error:null}), getClaims:async()=>({data:{claims:{sub:subject,session_id:session}},error:null}) }};
  };
}
test('authenticated user reaches a scoped draft without persistence or lookup callbacks', async()=>{
  globalThis.__trainerClient=fixture();
  const view=await page.default();
  assert.equal(view.props.expectedUser,uid);
  assert.equal(view.props.expectedSession,sid);
  assert.match(view.props.scope,/^v1\.[A-Za-z0-9_-]{43}$/);
  assert.equal(view.props.saveDraft,undefined);
  assert.equal(view.props.lookupCities,undefined);
  assert.equal(view.props.searchSports,undefined);
});
test('missing user, crossed claims, missing session and provider failure redirect before draft render',async()=>{
  for (const item of [{user:null},{subject:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{session:null},{fail:true}]) {
    globalThis.__trainerClient=fixture(item);
    await assert.rejects(page.default(), error=>error.message==='redirect:/entrar');
  }
});
test('replacement session changes the opaque draft key',async()=>{
  globalThis.__trainerClient=fixture();
  const first=await page.default();
  globalThis.__trainerClient=fixture({session:'22222222-2222-4222-8222-222222222222'});
  const second=await page.default();
  assert.notEqual(first.props.scope,second.props.scope);
  assert.notEqual(first.key,second.key);
});
