// UI smoke only: runs with auth disabled against a loopback production build.
// No Supabase credentials, external calls, or real accounts are used.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:38961';
const child = spawn('./node_modules/.bin/next', ['start', '-H', '127.0.0.1', '-p', '38961'], {
  stdio: 'ignore',
  env: { PATH: process.env.PATH, NODE_ENV: 'production', AUTH_SSR_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1' },
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Local server exited before starting');
    try {
      const response = await fetch(origin, { redirect: 'error' });
      if (response.ok) { ready = true; break; }
    } catch { /* Not listening yet. */ }
    await delay(200);
  }
  assert.ok(ready, 'Local server did not start');
  browser = await chromium.launch();
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === origin ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const response = await page.goto(origin, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.match(response.headers()['x-robots-tag'] || '', /noindex/i);
      assert.equal(await page.getByRole('heading', { name: 'ENCONTRE SEU TREINADOR.' }).count(), 1);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Pular para o conteúdo');
      await page.getByRole('link', { name: 'Cadastro', exact: true }).click();
      await page.getByText('Cadastro temporariamente indisponível.').waitFor();
      assert.equal(await page.getByRole('button', { name: /Criar conta/ }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Continuar com Google' }).isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'horizontal overflow');
      await page.goto(`${origin}/entrar`, { waitUntil: 'domcontentloaded' });
      await page.getByText('O acesso está temporariamente indisponível.').waitFor();
      await page.goto(`${origin}/painel`, { waitUntil: 'domcontentloaded' });
      assert.equal(new URL(page.url()).pathname, '/entrar', 'private page should not be accessible');
      console.log(`PASS isolated UI ${viewport.width}x${viewport.height}`);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  child.kill();
}
