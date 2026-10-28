// Read-only smoke against the explicitly designated public preview.
// It sends no cookies, secrets, forms or requests to Supabase.
import { pathToFileURL } from 'node:url';

const origin = 'https://novo99-five.vercel.app';
if (process.env.BASE_URL && process.env.BASE_URL !== origin) throw new Error('Unexpected preview origin');

export function verifyPublicPage(response) {
  if (response.status !== 200) throw new Error('A public page did not return HTTP 200');
  if (!/\bnoindex\b/i.test(response.headers.get('x-robots-tag') || '')) {
    throw new Error('A public page did not send X-Robots-Tag noindex');
  }
}

export function verifyPrivateRedirect(response) {
  if (![302, 303, 307, 308].includes(response.status)) {
    throw new Error('The unauthenticated private page did not redirect');
  }
  let target;
  try { target = new URL(response.headers.get('location') || '', origin); }
  catch { throw new Error('The private-page redirect is invalid'); }
  if (target.origin !== origin || target.pathname !== '/entrar') {
    throw new Error('The private-page redirect did not stay on the expected login route');
  }
}

export async function runRemoteSmoke(fetcher = fetch) {
  for (const path of ['/cadastro', '/entrar']) {
    const response = await fetcher(`${origin}${path}`, {
      method: 'GET', redirect: 'manual', cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    verifyPublicPage(response);
  }
  const privateResponse = await fetcher(`${origin}/painel`, {
    method: 'GET', redirect: 'manual', cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  verifyPrivateRedirect(privateResponse);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runRemoteSmoke();
    console.log('PASS: public routes noindex and unauthenticated panel redirects to login.');
  } catch {
    // Avoid provider content, URLs, headers and transport details in logs.
    console.error('FAIL: remote read-only smoke; inspect deployment configuration.');
    process.exitCode = 1;
  }
}
