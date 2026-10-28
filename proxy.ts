import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from './lib/config.mjs';

// The feature remains disabled until cross-tab cookie ordering is resolved.
// Proxy refreshes only; the page independently verifies getUser for access.
export async function proxy(request:NextRequest) {
  const config=supabaseConfig(process.env);
  if(process.env.AUTH_SSR_ENABLED!=='true'||!config) {
    const response=NextResponse.next({request});response.headers.set('Cache-Control','private, no-store');return response;
  }
  const staged:{name:string;value:string;options:CookieOptions}[]=[];
  const client=createServerClient(config.url,config.key,{cookies:{
    getAll(){return request.cookies.getAll();},
    setAll(items:{name:string;value:string;options:CookieOptions}[]){
      for(const item of items){request.cookies.set(item.name,item.value);staged.push(item);}
    },
  }});
  try {
    const {data,error}=await client.auth.getUser();
    if(error||!data.user){const fail=NextResponse.redirect(new URL('/entrar',request.url));fail.headers.set('Cache-Control','private, no-store');return fail;}
    const response=NextResponse.next({request});response.headers.set('Cache-Control','private, no-store');
    for(const {name,value,options} of staged)response.cookies.set(name,value,options);
    return response;
  } catch {const fail=NextResponse.redirect(new URL('/entrar',request.url));fail.headers.set('Cache-Control','private, no-store');return fail;}
}
export const config={matcher:['/painel/:path*','/onboarding/treinador/:path*']};
