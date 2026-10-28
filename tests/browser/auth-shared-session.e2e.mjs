// Isolated, synthetic integration exercise. It builds a temporary copy of the
// app with its Supabase endpoint replaced by an in-process loopback fake. No
// real Auth tenant, credentials, data, or deploy are used. Requires Chromium,
// Playwright, installed project dependencies, and permission to build Next.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), '99coach-auth-e2e-'));
const appOrigin = 'http://127.0.0.1:38971';
let provider, next, browser;
let pageA, pageB;
let phase = 'setup';
const providerEvents = [];
const browserEvents = [];
const serverSignals = new Set();
function recordEvent(list, value) { if (list.length < 100) list.push(value); }
const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', sid: '11111111-1111-4111-8111-111111111111' };
const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.test', sid: '22222222-2222-4222-8222-222222222222' };
let releaseA;
const delayedA = new Promise(resolve => { releaseA = resolve; });
let enteredA;
const sawA = new Promise(resolve => { enteredA = resolve; });
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const userData = u => ({ id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
function token(u) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, session_id: u.sid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.${Buffer.from('synthetic-signature').toString('base64url')}`;
}
const tokenA = token(userA), tokenB = token(userB);
const tokens = new Map([[tokenA, userA], [tokenB, userB]]);
const send = (res, status, payload) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': appOrigin, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' }); res.end(JSON.stringify(payload)); };

try {
  for (const name of ['app', 'components', 'lib', 'public', 'next.config.ts', 'next-env.d.ts', 'package.json', 'tsconfig.json', 'proxy.ts']) {
    await cp(path.join(root, name), path.join(temp, name), { recursive: true });
  }
  // Turbopack does not resolve modules outside its workspace root. Copy the
  // already installed dependencies instead of linking them out of the fixture.
  // Keep npm's relative .bin links relative to the copied node_modules tree.
  await cp(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  // A test-only replacement: production config stays fixed to the new tenant.
  const original = await readFile(path.join(temp, 'lib/config.mjs'), 'utf8');
  if (!original.includes('https://rycaxboqkkiopjdecgld.supabase.co')) throw new Error('Unexpected production config; refusing fixture');
  provider = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { recordEvent(providerEvents, 'options'); return send(res, 200, {}); }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      let body = ''; for await (const chunk of req) body += chunk;
      const email = JSON.parse(body).email;
      const user = email === userA.email ? userA : email === userB.email ? userB : null;
      recordEvent(providerEvents, user === userA ? 'login-A' : user === userB ? 'login-B' : 'login-other');
      if (!user) return send(res, 400, { error: 'invalid_credentials' });
      if (user === userA) { enteredA(); await delayedA; }
      const access = user === userA ? tokenA : tokenB;
      return send(res, 200, { access_token: access, refresh_token: `synthetic-${user.sid}`, expires_in: 3600, token_type: 'bearer', user: userData(user) });
    }
    if (url.pathname === '/auth/v1/user') {
      const user = tokens.get((req.headers.authorization || '').replace(/^Bearer /, ''));
      recordEvent(providerEvents, user === userA ? 'user-A' : user === userB ? 'user-B' : 'user-unauthorized');
      return user ? send(res, 200, userData(user)) : send(res, 401, { error: 'unauthorized' });
    }
    if (url.pathname === '/auth/v1/logout') { recordEvent(providerEvents, 'logout'); return send(res, 200, {}); }
    recordEvent(providerEvents, 'other-endpoint');
    return send(res, 404, { error: 'not_found' });
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const providerOrigin = `http://127.0.0.1:${provider.address().port}`;
  await writeFile(path.join(temp, 'lib/config.mjs'), `export function supabaseConfig(env) { return env.NEXT_PUBLIC_SUPABASE_URL === ${JSON.stringify(providerOrigin)} && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'sb_publishable_fixture' ? {url:env.NEXT_PUBLIC_SUPABASE_URL,key:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} : null; }\n`);
  // authOrigin permits localhost for HTTP, not a numeric loopback address.
  // This fixture exercises login/logout, not signup or the callback.
  const env = { PATH: process.env.PATH, AUTH_SSR_ENABLED: 'true', AUTH_APP_ORIGIN: 'http://localhost:38971', AUTH_SESSION_FENCE_SECRET: 'synthetic-fixture-key-32-characters-long', NEXT_PUBLIC_SUPABASE_URL: providerOrigin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', NEXT_TELEMETRY_DISABLED: '1', CI: 'true' };
  const nextBin = path.join(temp, 'node_modules/.bin/next');
  const build = spawnSync(nextBin, ['build'], { cwd: temp, env, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('Synthetic fixture build failed');
  next = spawn(nextBin, ['start', '-H', '127.0.0.1', '-p', '38971'], { cwd: temp, env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [next.stdout, next.stderr]) stream.on('data', chunk => {
    const value = chunk.toString();
    for (const signal of ['AUTH_UNAVAILABLE', 'AUTH_REFRESH_REQUIRED', 'Failed to fetch', 'TypeError', 'Error']) {
      if (value.includes(signal)) serverSignals.add(signal);
    }
  });
  let ready = false;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(appOrigin)).ok) { ready = true; break; } } catch {} await delay(200); }
  assert.ok(ready, 'Fixture server unavailable');
  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const destination = new URL(route.request().url());
    return [appOrigin, providerOrigin].includes(destination.origin) ? route.continue() : route.abort();
  });
  const a = pageA = await context.newPage(), b = pageB = await context.newPage();
  for (const [page, label] of [[a, 'A'], [b, 'B']]) {
    page.on('requestfailed', request => {
      const target = new URL(request.url());
      const kind = target.origin === providerOrigin ? 'provider' : target.origin === appOrigin ? 'app' : 'blocked-external';
      recordEvent(browserEvents, `${label}-request-failed-${kind}`);
    });
    page.on('pageerror', error => recordEvent(browserEvents, `${label}-page-error-${error.name}`));
  }
  for (const page of [a, b]) await page.goto(`${appOrigin}/entrar`);
  await a.getByLabel('E-mail').fill(userA.email); await a.getByLabel('Senha').fill('syntheticPassword1!');
  await a.getByRole('button', { name: 'Entrar', exact: true }).click();
  await Promise.race([sawA, delay(10000).then(() => { throw new Error('Delayed A request did not reach fake'); })]);
  await b.getByLabel('E-mail').fill(userB.email); await b.getByLabel('Senha').fill('syntheticPassword1!');
  await b.getByRole('button', { name: 'Entrar', exact: true }).click();
  phase = 'waiting-for-B';
  await b.getByText(`Conta: ${userB.email}`).waitFor({ timeout: 15000 });
  releaseA();
  await a.getByText(`Conta: ${userA.email}`).waitFor({ timeout: 15000 });
  // This dispatch is synthetic; it does not prove operating-system focus or
  // user-driven tab activation. It exercises the registered focus handler.
  await b.bringToFront(); await b.evaluate(() => window.dispatchEvent(new Event('focus')));
  await b.getByText(`Conta: ${userA.email}`).waitFor({ timeout: 15000 });
  assert.equal(await b.getByText(`Conta: ${userB.email}`).count(), 0);
  await b.reload();
  await b.getByText(`Conta: ${userA.email}`).waitFor({ timeout: 15000 });
  await a.getByRole('button', { name: 'Sair', exact: true }).click();
  await a.waitForURL('**/entrar');
  await b.reload(); await b.waitForURL('**/entrar');
  await context.close();
  console.log('PASS: synthetic shared session, delayed login and logout');
} catch (error) {
  // Fixture-only diagnostics: report categories, never headers, token values,
  // response bodies, arbitrary URLs, credentials or browser storage contents.
  const pages = {};
  for (const [label, page] of [['A', pageA], ['B', pageB]]) {
    if (!page || page.isClosed()) continue;
    try {
      const pathname = new URL(page.url()).pathname;
      const body = await page.locator('body').innerText({ timeout: 1000 });
      pages[label] = {
        route: ['/entrar', '/painel', '/cadastro'].includes(pathname) ? pathname : 'other',
        hasAccountA: body.includes(`Conta: ${userA.email}`),
        hasAccountB: body.includes(`Conta: ${userB.email}`),
        verifying: body.includes('Verificando sessão'),
        sessionChanged: body.includes('A sessão mudou'),
        unavailable: body.includes('Não foi possível'),
      };
    } catch { pages[label] = { state: 'unavailable' }; }
  }
  console.error('Synthetic fixture diagnostics:', JSON.stringify({ phase, pages, providerEvents, browserEvents, serverSignals: [...serverSignals] }));
  throw error;
} finally {
  releaseA?.();
  if (browser) await browser.close();
  if (next && next.exitCode === null && next.signalCode === null) {
    const exited = once(next, 'exit');
    next.kill();
    const stopped = await Promise.race([exited.then(() => true), delay(5000).then(() => false)]);
    if (!stopped) { next.kill('SIGKILL'); await exited; }
  }
  if (provider) await new Promise(resolve => provider.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
