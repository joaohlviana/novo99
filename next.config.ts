import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  async headers() { return [{ source: '/onboarding/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }, { source: '/:path*', headers: [
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ] }]; },
};
export default config;
