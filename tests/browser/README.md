# Teste isolado de sessão compartilhada

`auth-shared-session.e2e.mjs` é uma fixture sintética incluída no CI. Ela copia o app para diretório temporário, troca somente nessa cópia a configuração do Supabase por um servidor Auth falso em loopback e bloqueia chamadas externas do navegador. Usa contas e tokens sintéticos; não se conecta ao Supabase real nem usa segredos.

Requer dependências do app, Playwright e Chromium já instalados. Execute na raiz com `node tests/browser/auth-shared-session.e2e.mjs`. O teste faz build temporário e cobre duas tentativas de login, resposta atrasada, convergência pretendida, reload e logout. Não cobre cadastro, callback, entrega de e-mail ou Google. O evento de foco é disparado sinteticamente: não comprova foco do sistema ou navegação real entre abas. Também não comprova limpeza de rascunhos do onboarding.

Nesta VM foi verificada apenas a sintaxe do roteiro; não houve execução de build ou navegador. O teste precisa de revisão e execução em runner antes de ser tratado como evidência. O processo Next é encerrado e aguardado antes da remoção do diretório temporário.
