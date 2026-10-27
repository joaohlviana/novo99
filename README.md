# 99Coach — Next independente

Raiz do aplicativo: este diretório. Arquitetura escolhida: Next.js na Vercel; Supabase Auth, Database e Storage no projeto novo; Meilisearch no Railway; Stripe atual. Este candidato não é uma entrega validada: AUTH_SSR_ENABLED permanece false até resolver concorrência de cookies e provar o fluxo real. Não inclui dados de usuários antigos.

Node 24: `npm ci`, `npm run build`, `npm start`. Verificações: `npm test` e `npm run typecheck`. A instalação e o build desta versão não foram validados nesta VM por bloqueio ao registry npm.

Configuração prevista (nomes, sem valores): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, AUTH_SSR_ENABLED, AUTH_APP_ORIGIN, AUTH_SESSION_FENCE_SECRET. O segredo é exclusivamente servidor, aleatório e estável entre réplicas. AUTH_APP_ORIGIN é a origem exata da homologação; callback `${AUTH_APP_ORIGIN}/auth/callback` exige configuração de redirect no Supabase. Confirmação de email e entrega dependem da configuração de Auth/SMTP e teste real. Google segue indisponível.

Nenhuma migration está aprovada para aplicação. A fundação é SELECT-only; a inicialização está em drafts. Antes de ativar: revisão e teste dos cookies/duas abas, callback, retomada e logout; confirmar e-mail real e redirecionamentos; validar desktop e celular. A tela atual é apenas primeira etapa de identidade, não cadastro VFINAL completo.

Fontes: o manifesto original e o bundle DS VFINAL/Componentes-16 permanecem no repositório privado de origem até transferência oficial e verificação dos hashes. Não execute o migrador Better Auth e não migre dados do legado.
