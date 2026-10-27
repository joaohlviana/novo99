import type { Metadata } from 'next';
import { LoginFlow } from '../../components/signup/LoginFlow';
import '../../components/signup/register-form.css';
export const metadata:Metadata={title:'Entrar | 99Coach',robots:{index:false,follow:false}};
export default function Entrar(){return process.env.AUTH_SSR_ENABLED==='true'?<LoginFlow/>:<main id="main" className="main"><h1>ENTRAR</h1><p>O acesso está temporariamente indisponível.</p><a href="/cadastro">Cadastro</a></main>}
