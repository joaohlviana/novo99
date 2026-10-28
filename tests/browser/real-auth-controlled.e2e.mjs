// Opt-in test of an isolated Vercel preview with two already-confirmed accounts.
// This performs real login/logout. Never use production accounts or real user data.
import { chromium } from 'playwright';

const fail = message => { throw new Error(message); };
const originRaw = process.env.TEST_PREVIEW_ORIGIN;
let origin;
try {
  const u = new URL(originRaw || '');
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.vercel.app') || u.username || u.password || u.origin !== originRaw) fail('Invalid preview origin');
  origin = u.origin;
} catch { fail('TEST_PREVIEW_ORIGIN must be an isolated HTTPS *.vercel.app origin'); }
if (process.env.CONFIRM_ISOLATED_TEST_ACCOUNTS !== 'yes') fail('Explicit test-account acknowledgement is required');
// This is an operator acknowledgement, not proof: independently verify the
// Vercel project, deployment commit, exact origin, and Supabase tenant first.
if (process.env.CONFIRM_VERIFIED_DEPLOYMENT !== 'yes' || process.env.VERIFIED_PREVIEW_ORIGIN !== origin) fail('Verified deployment and exact origin acknowledgement required');
if (process.env.CONFIRM_CLEANUP_READY !== 'yes') fail('A verified official cleanup path is required before testing');
const a = { email: process.env.TEST_A_EMAIL, password: process.env.TEST_A_PASSWORD };
const b = { email: process.env.TEST_B_EMAIL, password: process.env.TEST_B_PASSWORD };
if (!a.email || !b.email || !a.password || !b.password || a.email.toLowerCase() === b.email.toLowerCase()) fail('Two distinct controlled accounts are required');

const authOrigin = 'https://rycaxboqkkiopjdecgld.supabase.co';
const browser = await chromium.launch({ headless: true });
let context;
let release;
let stage = 'preparação';
try {
  context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    return u.origin === origin || u.origin === authOrigin ? route.continue() : route.abort();
  });
  const tabA = await context.newPage(), tabB = await context.newPage();
  await Promise.all([tabA.goto(`${origin}/entrar`), tabB.goto(`${origin}/entrar`)]);
  stage = 'preparação dos logins';
  await tabA.getByLabel('E-mail').fill(a.email); await tabA.getByLabel('Senha').fill(a.password);
  await tabB.getByLabel('E-mail').fill(b.email); await tabB.getByLabel('Senha').fill(b.password);
  let arrived;
  const started = new Promise(resolve => { arrived = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  await tabA.route(`${authOrigin}/auth/v1/token**`, async route => {
    const u = new URL(route.request().url());
    if (route.request().method() !== 'POST' || u.searchParams.get('grant_type') !== 'password') return route.continue();
    const response = await route.fetch({ maxRedirects: 0 });
    if (response.status() >= 300 && response.status() < 400) {
      arrived(false);
      await route.abort();
      return;
    }
    arrived(true);
    await held;
    await route.fulfill({ response });
  });
  stage = 'primeiro login atrasado';
  await tabA.getByRole('button', { name: 'Entrar', exact: true }).click();
  const accepted = await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))]);
  if (!accepted) fail('Auth redirect is not permitted');
  stage = 'segundo login';
  await tabB.getByRole('button', { name: 'Entrar', exact: true }).click();
  await tabB.getByText(`Conta: ${b.email}`, { exact: true }).waitFor({ timeout: 30000 });
  stage = 'convergência da sessão compartilhada';
  release();
  const currentIdentity = tabA.getByText(/^Conta: /);
  await currentIdentity.waitFor({ timeout: 30000 });
  const displayed = await currentIdentity.textContent();
  if (displayed !== `Conta: ${a.email}` && displayed !== `Conta: ${b.email}`) fail('Unexpected effective identity');
  await tabB.bringToFront();
  await tabB.reload();
  await tabB.getByText(displayed, { exact: true }).waitFor({ timeout: 30000 });
  const prior = displayed === `Conta: ${a.email}` ? b.email : a.email;
  if (await tabB.getByText(`Conta: ${prior}`, { exact: true }).count()) fail('Previous identity still shown');
  stage = 'saída e retomada';
  await tabB.getByRole('button', { name: 'Sair', exact: true }).click();
  await tabB.waitForURL('**/entrar', { timeout: 30000 });
  await tabA.reload();
  await tabA.waitForURL('**/entrar', { timeout: 30000 });
  console.log('PASS: sessão compartilhada, resposta atrasada, reload e saída; contas controladas.');
} catch {
  // Do not print provider responses, test addresses, passwords, cookies or URLs.
  console.error(`FAIL: etapa ${stage}. Verifique o ambiente sem registrar credenciais.`);
  process.exitCode = 1;
} finally {
  release?.();
  await context?.close();
  await browser.close();
}
