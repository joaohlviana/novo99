# Smoke real de uma conta controlada — homologação

Este roteiro ainda não foi executado. Ele realiza login, reload e logout reais duas vezes, em contextos isolados de desktop e celular. Use exclusivamente uma conta confirmada sob controle do usuário no Supabase novo, e não perfis, usuários ou dados da plataforma anterior. O teste não cria nem remove contas.

Antes de fornecer credenciais, verifique pelos meios oficiais que `https://novo99-five.vercel.app` pertence ao projeto Vercel novo `prj_7joWxW5oZOfx24mMyGXHNGODcOp3`, confira o commit efetivamente implantado e que o ambiente aponta ao projeto Supabase `rycaxboqkkiopjdecgld`. Confirme que a conta é de teste, que há acesso oficial para limpá-la e que o preview está configurado sem indexação. Não infira o destino apenas pelo hostname. Os parâmetros de confirmação do script são declarações do operador, não verificação técnica do deployment ou da limpeza; o bloqueio de rede do navegador não controla o servidor Next.

As variáveis públicas do Supabase e `AUTH_SSR_ENABLED=true` precisam estar configuradas no projeto Vercel de teste antes do build/redeploy. `AUTH_APP_ORIGIN` é a origem exata acima; `AUTH_SESSION_FENCE_SECRET` é um segredo de servidor estável, de pelo menos 32 bytes, sem publicação no cliente. Mantenha a confirmação de e-mail ativa e verifique a configuração de envio, origem e callback no Supabase antes de testar cadastro. Google segue pendente. A proteção Vercel, se ativa, pode impedir o navegador automatizado e não é contornada.

Com Playwright e Chromium instalados no runner de nuvem, forneça somente ao processo, por canal seguro, `TEST_EMAIL`, `TEST_PASSWORD`, `VERIFIED_PREVIEW_ORIGIN`, `VERIFIED_VERCEL_PROJECT_ID`, `VERIFIED_SUPABASE_PROJECT_REF`, `VERIFIED_DEPLOY_COMMIT` (SHA completo) e as confirmações `CONFIRM_VERIFIED_DEPLOYMENT=yes`, `CONFIRM_CONTROLLED_ACCOUNT=yes`, `CONFIRM_CLEANUP_READY=yes`. Não escreva valores de credenciais em comandos persistidos, logs, arquivos, artefatos, screenshots ou histórico. Execute na raiz:

```sh
node tests/browser/real-auth-simple.e2e.mjs
```

O script aceita somente a origem e o projeto indicados, usa contextos novos em cada viewport, bloqueia outros hosts no navegador e imprime apenas a etapa aprovada ou falha, sem dados da conta. Sua execução comprovaria apenas o que for observado: entrada, identidade exibida, reload e saída para essa conta e deployment. Não cobre cadastro, envio ou confirmação de e-mail, Google, duas contas, expiração, concorrência, drafts, RLS ou acessibilidade completa. Após o teste, confirme o encerramento das sessões e remova apenas a conta de teste por meio oficial se essa remoção fizer parte do plano autorizado; registre evidência sem endereço, token, cookie ou senha.
