# 99Coach — Next independente

Raiz do aplicativo: este diretório. Arquitetura escolhida: Next.js na Vercel; Supabase Auth, Database e Storage no projeto novo; Meilisearch no Railway; Stripe atual. Este candidato não é uma entrega validada: AUTH_SSR_ENABLED permanece false até resolver concorrência de cookies e provar o fluxo real. Não inclui dados de usuários antigos.

Node 24: `npm ci`, `npm run build`, `npm start`. Verificações: `npm test` e `npm run typecheck`. A instalação e o build desta versão não foram validados nesta VM por bloqueio ao registry npm.

Configuração prevista (nomes, sem valores): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, AUTH_SSR_ENABLED, AUTH_APP_ORIGIN, AUTH_SESSION_FENCE_SECRET. O segredo é exclusivamente servidor, aleatório e estável entre réplicas. AUTH_APP_ORIGIN é a origem exata da homologação; callback `${AUTH_APP_ORIGIN}/auth/callback` exige configuração de redirect no Supabase. Confirmação de email e entrega dependem da configuração de Auth/SMTP e teste real. Google segue indisponível.

Nenhuma migration está aprovada para aplicação. A fundação é SELECT-only; a inicialização está em drafts. Antes de ativar: revisão e teste dos cookies/duas abas, callback, retomada e logout; confirmar e-mail real e redirecionamentos; validar desktop e celular. A tela atual é apenas primeira etapa de identidade, não cadastro VFINAL completo.

Fontes: o manifesto original e o bundle DS VFINAL/Componentes-16 permanecem no repositório privado de origem até transferência oficial e verificação dos hashes. Não execute o migrador Better Auth e não migre dados do legado.

A validação do login aceita senhas existentes não vazias; a regra de 12 caracteres é aplicada ao novo cadastro. A confirmação PKCE requer abrir o link no navegador que iniciou a tentativa. Uma perda da resposta pode impedir a confirmação e ainda não há recuperação validada.

`tests/cookie-race.test.mjs` reproduz com SDK instalado e transporte/cookies sintéticos que uma resposta atrasada da conta A pode sobrescrever o cookie da conta B. O teste demonstra somente que a última resposta aplicada determina o cookie; não demonstra vazamento entre usuários. O contrato escolhido é uma sessão compartilhada no navegador, com interface alinhada à identidade efetiva e limpeza de estado ao mudar de conta. Não há prova em navegador ou no Supabase real; o acesso permanece desligado por padrão até validação.

O CI executa instalação, testes, build e smoke de interface em desktop/celular com autenticação desligada. O Playwright é instalado no runner em versão direta fixada; suas dependências transitivas dessa instalação não estão no lockfile do app. O resultado só existe após a execução do GitHub Actions. `tests/browser-client-race.test.mjs` usa SDK real com transporte e cookies sintéticos; não comprova comportamento de navegador ou serviço real.

A primeira fatia usa uma sessão compartilhada no navegador: cadastro, entrada e saída usam `createBrowserClient`; o painel valida `getUser`/claims no servidor e revalida a identidade ao mudar a sessão ou voltar à aba. A saída verifica a sessão antes de chamar o SDK, mas essa verificação e a chamada não são atômicas. Alterações de cookie fora do SDK não são detectadas instantaneamente. A flag continua desligada até testes reais de confirmação, troca de contas, saída e recuperação.
