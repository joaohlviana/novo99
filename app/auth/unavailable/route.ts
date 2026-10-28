import { NextResponse } from 'next/server';

// No JavaScript or early form submission: never process credentials here.
export async function POST() {
  return new NextResponse('Aguarde o carregamento da página e tente novamente.', {
    status: 503,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
