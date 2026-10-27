import type { Metadata } from 'next';
import { RegisterFlow } from '../../components/signup/RegisterFlow';
import { RegisterForm } from '../../components/signup/RegisterForm';
import '../../components/signup/register-form.css';
export const metadata:Metadata={title:'Cadastro | 99Coach',robots:{index:false,follow:false}};
export default function Cadastro(){return process.env.AUTH_SSR_ENABLED==='true'?<RegisterFlow/>:<RegisterForm/>}
