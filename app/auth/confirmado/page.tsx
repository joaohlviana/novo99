import type { Metadata } from 'next';
export const metadata:Metadata={title:'Confirmação | 99Coach',robots:{index:false,follow:false}};
export default function Confirmado(){return <main id="main" className="main"><h1>CONFIRMAÇÃO</h1><p>Confira o estado da sua sessão antes de continuar.</p><a href="/painel">Continuar</a> · <a href="/entrar">Entrar</a></main>}
