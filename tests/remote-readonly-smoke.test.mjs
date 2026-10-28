import test from 'node:test';
import assert from 'node:assert/strict';
import { runRemoteSmoke } from './remote-readonly-smoke.mjs';

const html = () => new Response(null, { status: 200, headers: { 'x-robots-tag': 'noindex, nofollow' } });
const redirect = location => new Response(null, { status: 307, headers: { location } });

test('remote smoke uses exactly three fixed GET requests without following redirects', async () => {
  const calls = [];
  await runRemoteSmoke(async (url, options) => {
    calls.push([url, options.method, options.redirect]);
    return url.endsWith('/painel') ? redirect('/entrar') : html();
  });
  assert.deepEqual(calls, [
    ['https://novo99-five.vercel.app/cadastro', 'GET', 'manual'],
    ['https://novo99-five.vercel.app/entrar', 'GET', 'manual'],
    ['https://novo99-five.vercel.app/painel', 'GET', 'manual'],
  ]);
});

test('remote smoke rejects missing noindex and off-origin or accessible panel', async () => {
  await assert.rejects(runRemoteSmoke(async () => new Response(null, { status: 200 })));
  await assert.rejects(runRemoteSmoke(async url => url.endsWith('/painel') ? redirect('https://elsewhere.example/entrar') : html()));
  await assert.rejects(runRemoteSmoke(async () => html()));
});
