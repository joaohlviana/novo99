// Isolated VFINAL candidate check. Copies the app and mounts a TEST-ONLY route;
// never contacts Supabase, real identity providers, city APIs or deployment.
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), '99coach-vfinal-test-'));
const origin = 'http://127.0.0.1:38972';
const captureDir = path.resolve(process.env.VFINAL_SCREENSHOT_DIR || 'vfinal-screenshots');
let next, browser;
try {
  for (const name of ['app', 'components', 'lib', 'public', 'next.config.ts', 'next-env.d.ts', 'package.json', 'tsconfig.json', 'proxy.ts']) {
    await cp(path.join(root, name), path.join(temp, name), { recursive: true });
  }
  await cp(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  const route = path.join(temp, 'app', '__vfinal_fixture');
  await mkdir(route, { recursive: true });
  const source = await readFile(path.join(root, 'tests/browser/vfinal-fixture/page.tsx'), 'utf8');
  await writeFile(path.join(route, 'page.tsx'), source.replace('../../../components/', '../../components/'));
  const env = { PATH: process.env.PATH, AUTH_SSR_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1', CI: 'true' };
  const bin = path.join(temp, 'node_modules/.bin/next');
  const build = spawnSync(bin, ['build'], { cwd: temp, env, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('VFINAL fixture build failed');
  next = spawn(bin, ['start', '-H', '127.0.0.1', '-p', '38972'], { cwd: temp, env, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`${origin}/__vfinal_fixture`)).ok) { ready = true; break; } } catch {} await delay(200); }
  assert.ok(ready, 'VFINAL fixture did not start');
  browser = await chromium.launch();
  await mkdir(captureDir, { recursive: true });
  for (const width of [320, 390, 599, 600, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto(`${origin}/__vfinal_fixture`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /o que você treina/i }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      const card = page.getByTestId('vfinal-card');
      await card.waitFor();
      const geometry = await card.evaluate(el => ({ width: el.getBoundingClientRect().width, radius: getComputedStyle(el).borderTopLeftRadius }));
      assert.ok(geometry.width <= 560.5, `card too wide at ${width}`);
      assert.equal(geometry.radius, width < 600 ? '0px' : '18px', `card radius at ${width}`);
      for (const label of ['CrossFit', 'Musculação', 'Funcionais', 'LPO', 'Corrida', 'Pilates', 'Yoga', 'Lutas']) {
        assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1, `${label} missing at ${width}`);
      }
      for (const label of ['Português', 'Inglês', 'Espanhol', 'Presencial', 'Online']) {
        assert.ok(await page.getByText(label, { exact: true }).count() > 0, `${label} missing at ${width}`);
      }
      const cta = page.getByRole('button', { name: /salvar e continuar/i });
      assert.equal(await cta.isDisabled(), true, 'empty or unavailable persistence must not pretend to save');
      if ([320, 390, 768, 1440].includes(width)) await page.screenshot({ path: path.join(captureDir, `vfinal-${width}.png`), fullPage: true });
      const footerPosition = await page.getByTestId('vfinal-footer').evaluate(el => getComputedStyle(el).position);
      assert.equal(footerPosition, width < 600 ? 'fixed' : 'static', `footer position at ${width}`);
      console.log(`PASS VFINAL structure ${width}px`);
    } finally { await context.close(); }
  }
  // Keyboard, state and city tests use only the isolated synthetic source.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  try {
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`${origin}/__vfinal_fixture`, { waitUntil: 'domcontentloaded' });
    const nameInput = page.getByLabel('Nome', { exact: true });
    await nameInput.fill('Nome sintético');
    await nameInput.focus();
    await page.evaluate(() => (window).__fixtureRerender());
    assert.equal(await nameInput.inputValue(), 'Nome sintético', 'same scope parent re-render preserves draft');
    assert.equal(await nameInput.evaluate(el => el === document.activeElement), true, 'same scope parent re-render preserves focus');
    const options = ['CrossFit', 'Musculação', 'Funcionais', 'LPO', 'Corrida'];
    for (const option of options) await page.getByRole('button', { name: option, exact: true }).click();
    await page.getByRole('button', { name: 'Pilates', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Pilates', exact: true }).getAttribute('aria-pressed'), 'false', 'sixth selection must be refused');
    await page.getByRole('button', { name: /CrossFit/ }).click();
    await page.getByRole('button', { name: /Mais modalidades/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Mais modalidades' });
    await dialog.getByRole('searchbox', { name: /buscar modalidade/i }).fill('nat');
    await dialog.getByRole('button', { name: 'Natação', exact: true }).click();
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Mais modalidades'));
    assert.equal(await page.getByRole('button', { name: /Natação/ }).getAttribute('aria-pressed'), 'true', 'extra selection remains visible');
    await page.getByRole('button', { name: /^Presencial/ }).click();
    await page.getByRole('button', { name: /^Online/ }).click();
    assert.equal(await page.getByRole('button', { name: /^Presencial/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: /^Online/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: /salvar e continuar/i }).isDisabled(), true, 'in-person requires a normalized city');
    await page.getByRole('button', { name: /digite sua cidade/i }).click();
    const input = page.getByRole('combobox', { name: 'Buscar cidade' });
    await input.press('Escape');
    assert.equal(await page.getByRole('combobox', { name: 'Buscar cidade' }).count(), 0, 'Escape should close city chooser');
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Digite sua cidade'));
    await page.getByRole('button', { name: /digite sua cidade/i }).click();
    await input.fill('to');
    await page.getByRole('option', { name: /Toledo.*PR/i }).waitFor();
    await page.getByRole('option', { name: /Toledo.*MG/i }).waitFor();
    assert.equal(await page.getByTestId('vfinal-footer').isVisible(), false, 'mobile footer should hide while city is open');
    await input.press('ArrowDown');
    assert.ok(await input.getAttribute('aria-activedescendant'), 'arrow navigation should identify active option');
    await input.press('Enter');
    assert.equal(await page.getByRole('combobox', { name: 'Buscar cidade' }).count(), 0, 'city chooser should close');
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Onde você atende');
    assert.equal(await page.getByTestId('vfinal-footer').isVisible(), true);
    const save = page.getByRole('button', { name: /salvar e continuar/i });
    assert.equal(await save.isEnabled(), true, 'valid synthetic input enables the explicit action');
    const portuguese = page.getByRole('button', { name: /Português/ });
    await portuguese.click();
    assert.equal(await portuguese.getAttribute('aria-pressed'), 'true', 'last language must remain selected');
    await page.getByRole('button', { name: /Inglês/ }).click();
    await portuguese.click();
    assert.equal(await portuguese.getAttribute('aria-pressed'), 'false', 'another selected language permits removal');
    await save.click();
    await page.getByRole('alert').filter({ hasText: /não foi possível confirmar o salvamento/i }).waitFor();
    assert.equal(await page.getByText(/salvo com sucesso/i).count(), 0, 'failed synthetic save must not be presented as success');
    assert.equal(await save.isDisabled(), true, 'unknown save must not be silently retried');
    await page.evaluate(() => (window).__fixtureSetScope('synthetic-session-B'));
    assert.equal(await page.getByLabel('Nome', { exact: true }).inputValue(), '', 'different session clears prior name');
    assert.equal(await page.getByRole('button', { name: 'CrossFit', exact: true }).getAttribute('aria-pressed'), 'false', 'different session clears prior sport');
    assert.equal(await page.getByText(/Toledo, (PR|MG)/).count(), 0, 'different session clears prior city');
    assert.equal(await page.getByText(/treinadores.*atendem aqui/i).count(), 0, 'fixture must not display fictional counts');
    console.log('PASS VFINAL selection, city and keyboard with synthetic data');
  } finally { await context.close(); }
} finally {
  if (browser) await browser.close();
  if (next && next.exitCode === null) {
    const exit = once(next, 'exit').catch(() => {}); next.kill('SIGTERM');
    await Promise.race([exit, delay(3000)]);
    if (next.exitCode === null) { next.kill('SIGKILL'); await Promise.race([exit, delay(3000)]); }
  }
  await rm(temp, { recursive: true, force: true });
}
