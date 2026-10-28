import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { NextRequest } from 'next/server.js';
import ts from 'typescript';

// The real proxy with Next request/response and SDK; no network is expected.
const source=await readFile(new URL('../proxy.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  .replace("from 'next/server'", "from 'next/server.js'")
  .replace("from './lib/config.mjs'", "from '../lib/config.mjs'");
const temp=new URL(`./trainer-proxy-${process.pid}.tmp.mjs`,import.meta.url);
await writeFile(temp,js);
let proxy;
try { proxy=await import(temp.href); } finally { await unlink(temp); }
const old={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,flag:process.env.AUTH_SSR_ENABLED,fetch:globalThis.fetch};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://rycaxboqkkiopjdecgld.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
process.env.AUTH_SSR_ENABLED='true';
test.after(()=>{for(const [key,value] of [['NEXT_PUBLIC_SUPABASE_URL',old.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',old.key],['AUTH_SSR_ENABLED',old.flag]]) {if(value===undefined)delete process.env[key];else process.env[key]=value;}globalThis.fetch=old.fetch;});
test('onboarding route uses the protected refresh proxy and redirects an anonymous request without caching',async()=>{
  assert.ok(proxy.config.matcher.includes('/onboarding/treinador/:path*'));
  globalThis.fetch=async()=>{throw new Error('No network expected');};
  const response=await proxy.proxy(new NextRequest('https://preview.example.test/onboarding/treinador'));
  assert.equal(response.status,307);
  assert.equal(response.headers.get('location'),'https://preview.example.test/entrar');
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.cookies.getAll().length,0);
});
