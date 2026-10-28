import type { Metadata } from 'next';
import { RegisterFlow } from '../../components/signup/RegisterFlow';
import { RegisterForm } from '../../components/signup/RegisterForm';
import '../../components/signup/register-form.css';
import { authOrigin } from '../../lib/supabase-server';
export const metadata:Metadata={title:'Cadastro | 99Coach',robots:{index:false,follow:false}};
export default function Cadastro(){const origin=authOrigin();return process.env.AUTH_SSR_ENABLED==='true' && origin?<RegisterFlow callbackOrigin={origin}/>:<RegisterForm/>}
