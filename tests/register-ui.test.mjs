import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = await readFile(new URL('../components/signup/RegisterForm.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext}}).outputText;
const temp = new URL(`../components/signup/register-ui-${process.pid}.tmp.mjs`, import.meta.url);
await writeFile(temp, compiled);
let RegisterForm;
try { ({RegisterForm} = await import(temp.href)); } finally { await unlink(temp); }
const render = (props) => renderToStaticMarkup(createElement(RegisterForm, props));

test('signup is closed by default and does not represent Google as active', () => {
  const html=render({});
  assert.match(html,/Cadastro temporariamente indisponível/);
  assert.match(html,/Google temporariamente indisponível/);
  assert.match(html,/<button class="register-primary" type="submit" disabled=""/);
  assert.match(html,/<button class="register-google" type="button" disabled=""/);
});
test('form provides labels, browser constraints and no insecure handler by default', () => {
  const html=render({onSubmit:()=>{}});
  for (const term of ['Nome','E-mail','Senha','Confirme sua senha','18 anos','Como você quer começar?']) assert.ok(html.includes(term));
  assert.match(html,/id="register-password"[^>]*minLength="12"/);
  assert.match(html,/<input(?=[^>]*type="checkbox")(?=[^>]*required)(?=[^>]*name="adult")/);
  assert.match(html,/<form(?=[^>]*method="post")(?=[^>]*action="\/auth\/unavailable")/);
  assert.match(html,/<button class="register-primary" type="submit" disabled/);
  assert.match(html,/<input(?=[^>]*name="email")(?=[^>]*disabled)/);
});
test('pending and uncertain outcomes block another submission and report the distinction', () => {
  for (const state of ['pending','check-email','unconfirmed']) {
    const html=render({onSubmit:()=>{},status:state});
    assert.match(html,/<button class="register-primary" type="submit" disabled=""/);
    assert.match(html,/role="status" aria-live="polite"/);
  }
  assert.match(render({onSubmit:()=>{},status:'unconfirmed'}),/Não foi possível confirmar o resultado/);
  assert.match(render({onSubmit:()=>{},status:'error'}),/role="alert"/);
});
