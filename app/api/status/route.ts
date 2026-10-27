import { capabilityStatus } from '../../../lib/status.mjs';
export async function GET() { return Response.json(capabilityStatus(), { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } }); }
