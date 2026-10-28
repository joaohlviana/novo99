// Opt-in real login test. Use only a confirmed, exclusively controlled test
// account in the verified new 99Coach tenant and the verified isolated preview.
// This performs login and logout; it never creates or deletes accounts.
import { chromium } from 'playwright';

const expectedOrigin = 'https://novo99-five.vercel.app';
const authOrigin = 'https://rycaxboqkkiopjdecgld.supabase.co';
const expectedProject = 'prj_7joWxW5oZOfx24mMyGXHNGODcOp3';
const expectedRef = 'rycaxboqkkiopjdecgld';
const stageError = message => { throw new Error(message); };

// These flags record operator acknowledgement; they do not themselves prove
// deployment ownership, deployed commit, tenant configuration, or cleanup.
if (process.env.CONFIRM_VERIFIED_DEPLOYMENT !== 'yes' ||
    process.env.CONFIRM_CONTROLLED_ACCOUNT !== 'yes' ||
    process.env.CONFIRM_CLEANUP_READY !== 'yes' ||
    process.env.VERIFIED_PREVIEW_ORIGIN !== expectedOrigin ||
    process.env.VERIFIED_VERCEL_PROJECT_ID !== expectedProject ||
    process.env.VERIFIED_SUPABASE_PROJECT_REF !== expectedRef ||
    !/^[0-9a-f]{40}$/i.test(process.env.VERIFIED_DEPLOY_COMMIT || '')) {
  stageError('Deployment, account and cleanup acknowledgements required');
}

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
if (!email || !password || !email.includes('@')) stageError('Controlled account credentials required');

let browser;
let context;
let phase = 'preparação';
try {
  browser = await chromium.launch({ headless: true });
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['celular', { width: 390, height: 844 }]]) {
    phase = `abrir ${label}`;
    context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const target = new URL(route.request().url());
      return target.origin === expectedOrigin || target.origin === authOrigin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const entry = await page.goto(`${expectedOrigin}/entrar`, { waitUntil: 'domcontentloaded' });
    if (!entry || entry.status() !== 200 || new URL(page.url()).origin !== expectedOrigin) stageError('Preview unavailable');
    phase = `entrada ${label}`;
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByText(`Conta: ${email}`, { exact: true }).waitFor({ timeout: 30000 });
    if (new URL(page.url()).origin !== expectedOrigin || new URL(page.url()).pathname !== '/painel') stageError('Unexpected destination');
    phase = `retomada ${label}`;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(`Conta: ${email}`, { exact: true }).waitFor({ timeout: 30000 });
    phase = `saída ${label}`;
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.waitForURL(url => url.origin === expectedOrigin && url.pathname === '/entrar', { timeout: 30000 });
    await page.goto(`${expectedOrigin}/painel`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.origin === expectedOrigin && url.pathname === '/entrar', { timeout: 30000 });
    await context.close();
    context = undefined;
    console.log(`PASS: entrada, retomada e saída — ${label}.`);
  }
} catch {
  // Do not emit email, passwords, URLs, responses, cookies, stack traces, or
  // screenshots. The operator diagnoses privately without sharing secrets.
  console.error(`FAIL: etapa ${phase}. Não registrar credenciais ou respostas.`);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
}
