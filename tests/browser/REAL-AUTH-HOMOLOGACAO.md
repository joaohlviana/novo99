# Teste real de identidade — homologação isolada

Este roteiro **ainda não foi executado**. O script faz login e logout reais e só deve usar duas contas de teste criadas exclusivamente no projeto Supabase novo, caixas postais controladas e um projeto Vercel de homologação isolado. Não use contas de pessoas, o domínio antigo ou produção. Guarde um registro interno dos IDs das duas contas para limpeza; um sufixo de e-mail não comprova que uma conta é descartável.

## Configuração antes do teste

- Projeto Supabase: `99coach-v2`, ref `rycaxboqkkiopjdecgld`; confirmação de e-mail permanece ativa. Verificar se o SMTP efetivamente envia para as duas caixas de teste; o serviço de e-mail padrão do Supabase tem restrições. Não declarar entrega comprovada só porque cadastro retornou sucesso.
- Antes de criar fixtures ou testar, confira por meios oficiais que o deployment pertence ao **projeto Vercel novo de homologação**, qual é o commit exato implantado, a origem exata a ser usada e que a configuração aponta para o tenant Supabase novo. Não deduza isso apenas do nome ou do sufixo do domínio; preserve a evidência sem registrar segredos.
- Projeto Vercel novo de homologação: defina `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do projeto novo; `AUTH_APP_ORIGIN` deve ser exatamente a origem HTTPS usada no teste, sem barra final; `AUTH_SESSION_FENCE_SECRET` deve ser segredo aleatório estável de pelo menos 32 bytes, apenas no servidor. Configure `AUTH_SSR_ENABLED=true` **antes do build/redeploy** nesse ambiente autorizado: as páginas podem incorporar a flag na construção. Confirme no deployment efetivo que cadastro/entrada estão habilitados para teste. Não colocar valores de segredo em Git, tela, comandos gravados ou logs.
- Configure na Auth do projeto novo a origem/callback permitidos para `${AUTH_APP_ORIGIN}/auth/callback`, inclusive o comportamento de `sb_flow_id` usado pela versão instalada. Não remova callbacks existentes. Valide o redirect exato e qualquer query permitida no painel; não use wildcard amplo por conveniência. O callback PKCE requer o mesmo navegador que iniciou o cadastro.
- O preview deve permanecer `noindex`; se a proteção de acesso Vercel pedir login, use um contexto de navegador autorizado. O script automatizado abaixo inicia um contexto limpo e não contorna proteção, portanto pode não conseguir acessá-lo. Confirme **antes de criar contas** que há acesso oficial para remover exclusivamente as duas fixtures identificadas; sem esse caminho, não comece o teste.
- Google permanece separado e desabilitado até configurar e testar o provedor real. Não há cobrança Stripe nem cadastro de perfil nessa prova.

## Cadastro e confirmação — manual

1. Em um navegador de teste limpo, abra `/cadastro`, use a primeira caixa postal sintética controlada e uma senha exclusiva, e conclua a autodeclaração exigida pela tela. Não informe dados pessoais reais. A declaração não é consentimento legal persistido.
2. Verifique que o aplicativo pede confirmação e que **a mensagem chegou** à caixa controlada. Abra o link no mesmo navegador e verifique o retorno à origem de homologação e `/auth/confirmado`; consulte `/painel` e confira a identidade. Se houver resultado desconhecido, não repita automaticamente; registre o estado e preserve evidência sem imprimir o link, token, senha ou endereço.
3. Saia e repita para a segunda conta. A confirmação em outro navegador/dispositivo, perda de resposta e reenvio ainda são casos pendentes; não trate o cadastro como validado se não ocorrer envio, callback e sessão reais.

## Login de duas contas e logout — Playwright

Com Playwright/Chromium já instalados no ambiente de teste, injete os valores **no ambiente do processo**, por um meio seguro do executor; não os escreva em arquivo, shell history, logs, screenshots, traces ou repositório. Variáveis exigidas:

`TEST_PREVIEW_ORIGIN`, `VERIFIED_PREVIEW_ORIGIN` (o mesmo valor exato conferido no painel), `TEST_A_EMAIL`, `TEST_A_PASSWORD`, `TEST_B_EMAIL`, `TEST_B_PASSWORD`, `CONFIRM_ISOLATED_TEST_ACCOUNTS=yes`, `CONFIRM_VERIFIED_DEPLOYMENT=yes`, `CONFIRM_CLEANUP_READY=yes`.

Execute na raiz do projeto:

```sh
node tests/browser/real-auth-controlled.e2e.mjs
```

O script recusa origens que não sejam HTTPS `*.vercel.app`, exige as declarações explícitas e uma segunda origem igual à primeira, confirma duas identidades distintas e restringe chamadas aos hosts do preview e do Supabase novo. **Essas verificações locais não comprovam que o deployment, commit, tenant ou contas são os corretos**: a conferência oficial é responsabilidade do operador antes do teste. A interceptação do login atrasado não segue redirects e aborta ao receber 3xx. O script atrasa a resposta do primeiro login, conclui o segundo, libera o primeiro e verifica que as abas convergem para a **sessão efetivamente exibida**, sem assumir qual conta vence. Depois recarrega e sai. O log imprime somente PASS/FAIL e a etapa, sem corpo HTTP nem credenciais. A ferramenta não salva screenshots, traces ou storage state. Inspecione também visualmente o navegador de teste se a execução falhar; nunca publique dados privados do teste.

Repita manualmente em viewport desktop e celular: logout concorrente entre abas, voltar foco, reload, expiração/refresh da sessão e cancelamento. A verificação antes do logout e a chamada ao SDK não são atômicas; registre qual identidade foi afetada. O roteiro não prova automaticamente limpeza de rascunhos do onboarding, confirmação por e-mail, provedor Google, token expirado ou todas as corridas.

## Limpeza e evidências

Ao terminar, encerre ambas as sessões, remova **somente as duas contas sintéticas identificadas** por meio oficial do Supabase Auth Admin/painel autorizado e verifique sua remoção. Não apague usuários por padrão amplo e não toque dados da plataforma antiga. Se não houver acesso oficial de limpeza, interrompa a criação das fixtures e registre o bloqueio antes de começar. Revogação de sessão e remoção de usuário não comprovam invalidação imediata de todos os JWTs já emitidos.

Registre commit, URL do preview, data, configuração sem valores sensíveis, origem permitida, envio e callback, resultado por conta, navegador/viewport, conclusão do teste e evidência de cleanup. Diferencie observações reais de fixtures e simulações; não registre e-mails, cookies, tokens, senhas ou links de confirmação. Desative a flag se houver divergência ou se a homologação não estiver mais sendo usada.
