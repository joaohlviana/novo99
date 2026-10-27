import { NextResponse, type NextRequest } from 'next/server';
import { exchangePkceCallback } from '../../../lib/pkce-callback.mjs';
import { authOrigin } from '../../../lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const origin=authOrigin();
  if (!origin || process.env.AUTH_SSR_ENABLED !== 'true') return new NextResponse('Confirmação indisponível.',{status:503,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  const result=await exchangePkceCallback({rawUrl:request.url,configuredOrigin:origin,env:process.env,requestCookies:request.cookies.getAll()});
  const response=NextResponse.redirect(`${origin}${result.ok?'/auth/confirmado':'/auth/confirmado?estado=incerto'}`,303);
  response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
  if(result.ok && "cookies" in result) for(const cookie of result.cookies || []) response.cookies.set(cookie.name,cookie.value,cookie.options);
  return response;
}
