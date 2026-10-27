import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn('./node_modules/.bin/next',['start','-H','127.0.0.1','-p','38960'],{stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,NODE_ENV:'production'}});
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);child.stdout.on('data',b=>{if(b.toString().includes('Ready')){clearTimeout(timer);resolve();}});child.once('exit',()=>reject(Error('server exited')));});
 const home=await fetch('http://127.0.0.1:38960/');assert.equal(home.status,200);assert.match(home.headers.get('x-robots-tag')||'',/noindex/);assert.match(await home.text(),/ENCONTRE SEU TREINADOR/);
 const cadastro=await fetch('http://127.0.0.1:38960/cadastro');assert.equal(cadastro.status,200);assert.match(cadastro.headers.get('x-robots-tag')||'',/noindex/);assert.match(await cadastro.text(),/Cadastro temporariamente indisponível/);
 const login=await fetch('http://127.0.0.1:38960/entrar');assert.equal(login.status,200);assert.match(login.headers.get('x-robots-tag')||'',/noindex/);assert.match(await login.text(),/O acesso está temporariamente indisponível/);
 const robots=await fetch('http://127.0.0.1:38960/robots.txt');assert.match(await robots.text(),/Disallow: \/+/);
 const status=await fetch('http://127.0.0.1:38960/api/status');assert.equal(status.status,200);assert.equal((await status.json()).auth.google,false);assert.match(status.headers.get('cache-control')||'',/no-store/);
 console.log('PASS: HTML, noindex, robots e estado indisponível verificados por HTTP local.');
} finally {child.kill();}
