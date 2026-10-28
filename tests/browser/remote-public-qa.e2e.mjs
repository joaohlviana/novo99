// Opt-in public smoke on the explicitly authorized preview. No signup, email,
// real accounts, secrets, traces or screenshots. Invalid login is synthetic.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { isExpectedSyntheticLogin } from './synthetic-login-guard.mjs';

const origin = 'https://novo99-five.vercel.app';
const provider = 'https://rycaxboqkkiopjdecgld.supabase.co';
if (process.env.BASE_URL !== origin) throw new Error('Unexpected preview origin');

const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const syntheticEmail = `qa-${randomUUID()}@example.invalid`;
    const syntheticPassword = 'synthetic-incorrect-password';
    let tokenRequests = 0;
    let unexpectedConsoleErrors = 0;
    let pageErrors = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin && request.method() === 'GET') {
        if (url.searchParams.has('email') || url.searchParams.has('password')) return route.abort();
        return route.continue();
      }
      // Exactly the explicitly authorized invalid-password check. Never allow
      // signup, recovery, OTP, or any other provider mutation.
      if (url.origin === provider && url.pathname === '/auth/v1/token' &&
          url.searchParams.get('grant_type') === 'password' && request.method() === 'POST' && tokenRequests === 0) {
        if (!isExpectedSyntheticLogin(request.postData() || '', syntheticEmail, syntheticPassword)) return route.abort();
        tokenRequests++;
        const response = await route.fetch({ maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400) return route.abort();
        return route.fulfill({ response });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', () => { pageErrors++; });
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const location = message.location().url || '';
      // Browsers report the expected 400 invalid-credentials resource as an
      // error in the console. Do not suppress unrelated application errors.
      const expected = location.startsWith(`${provider}/auth/v1/token`) && /status of 400\b/.test(message.text());
      if (!expected) unexpectedConsoleErrors++;
    });
    try {
      const home = await page.goto(origin, { waitUntil: 'domcontentloaded' });
      assert.equal(home.status(), 200, 'home must load');
      assert.match(home.headers()['x-robots-tag'] || '', /noindex/i);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Pular para o conteúdo');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'home overflow');

      const signup = await page.goto(`${origin}/cadastro`, { waitUntil: 'domcontentloaded' });
      assert.equal(signup.status(), 200, 'signup page must load');
      assert.match(signup.headers()['x-robots-tag'] || '', /noindex/i);
      const signupEmail = page.getByLabel('E-mail');
      await signupEmail.fill('invalid-email');
      assert.equal(await signupEmail.evaluate(element => element.validity.valid), false, 'signup email should reject invalid format');
      const signupPassword = page.getByLabel('Senha', { exact: true });
      await signupPassword.fill('short');
      assert.equal(await signupPassword.evaluate(element => element.validity.valid), false, 'signup password should reject short input');
      assert.equal(await page.getByLabel('Confirme sua senha').evaluate(element => element.validity.valid), false, 'confirmation should be required');
      assert.equal(await page.getByRole('button', { name: 'Continuar com Google' }).isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'signup overflow');
      // Do not click the signup button, even with invalid values.

      const login = await page.goto(`${origin}/entrar`, { waitUntil: 'domcontentloaded' });
      assert.equal(login.status(), 200, 'login page must load');
      assert.match(login.headers()['x-robots-tag'] || '', /noindex/i);
      await page.getByLabel('E-mail').fill(syntheticEmail);
      await page.getByLabel('Senha').fill(syntheticPassword);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByText('Não foi possível entrar. Confira seus dados e tente novamente.', { exact: true }).waitFor({ timeout: 30000 });
      assert.equal(tokenRequests, 1, 'one invalid login request expected');
      assert.equal(new URL(page.url()).pathname, '/entrar', 'invalid login must not enter the panel');
      assert.equal(await page.getByLabel('E-mail').isEditable(), true, 'email remains editable after rejection');
      assert.equal(await page.getByLabel('Senha').isEditable(), true, 'password remains editable after rejection');
      assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).isEnabled(), true, 'manual retry is available');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'login overflow');

      // Direct GETs only: no code, cookie or signup is created. Check privacy
      // headers before following redirects, not only the final page.
      const callback = await page.request.get(`${origin}/auth/callback`, { maxRedirects: 0 });
      assert.ok([302, 303, 307, 308].includes(callback.status()), 'empty callback must redirect to confirmation');
      assert.match(callback.headers()['cache-control'] || '', /no-store/i, 'callback must not be cached');
      const callbackDestination = new URL(callback.headers().location || '', origin);
      assert.equal(callbackDestination.origin, origin, 'callback redirect must remain on preview');
      assert.equal(callbackDestination.pathname, '/auth/confirmado');
      const protectedResponse = await page.request.get(`${origin}/painel`, { maxRedirects: 0 });
      assert.ok([302, 303, 307, 308].includes(protectedResponse.status()), 'anonymous panel must redirect');
      assert.match(protectedResponse.headers()['cache-control'] || '', /no-store/i, 'private response must not be cached');
      const destination = new URL(protectedResponse.headers().location || '', origin);
      assert.equal(destination.origin, origin, 'panel redirect must remain on preview');
      assert.equal(destination.pathname, '/entrar');
      await page.goto(`${origin}/painel`, { waitUntil: 'domcontentloaded' });
      assert.equal(new URL(page.url()).pathname, '/entrar', 'anonymous panel must redirect to login');
      assert.equal(pageErrors, 0, 'application raised a browser exception');
      assert.equal(unexpectedConsoleErrors, 0, 'unexpected browser console error');
      console.log(`PASS public preview ${viewport.width}x${viewport.height}: forms, invalid login, callback, anonymous panel, cache and layout`);
    } catch {
      // Playwright errors can include URLs; never print synthetic credentials
      // or a provider response to CI logs.
      throw new Error(`Public preview QA failed at viewport ${viewport.width}x${viewport.height}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
