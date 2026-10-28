import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = await readFile(new URL('../components/signup/LoginFlow.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText
  .replace("import { useRouter } from 'next/navigation';", "const useRouter = () => ({});")
  .replace("import { browserSupabase } from '../../lib/supabase-browser';", "const browserSupabase = () => { throw Error('not used in SSR'); };");
const temp = new URL(`./login-ssr-${process.pid}.tmp.mjs`, import.meta.url);
await writeFile(temp, compiled);
let LoginFlow;
try { ({ LoginFlow } = await import(temp.href)); } finally { await unlink(temp); }

test('initial login markup cannot submit credentials by GET before hydration', () => {
  const html = renderToStaticMarkup(createElement(LoginFlow));
  assert.match(html, /<form(?=[^>]*method="post")(?=[^>]*action="\/auth\/unavailable")/);
  assert.match(html, /<input(?=[^>]*name="email")(?=[^>]*disabled)/);
  assert.match(html, /<input(?=[^>]*name="password")(?=[^>]*disabled)/);
  assert.match(html, /type="submit" disabled/);
});
