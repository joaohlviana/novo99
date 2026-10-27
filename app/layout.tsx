import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/anton/latin-400.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource-variable/inter';
import './style.css';
export const metadata: Metadata = { title: '99Coach', description: 'Encontre seu treinador.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="pt-BR"><body><a className="skip" href="#main">Pular para o conteúdo</a>{children}</body></html>; }
