# Onboarding de treinador: contrato proposto

**Estado atual:** não há endpoint, tabela, migration ou persistência deste fluxo neste repositório. Esta especificação é um alvo para revisão, não um contrato disponível. A interface não deve informar que salvou, publicou, enviou uma cidade para revisão ou retomará dados depois de recarregar enquanto não receber confirmação real do serviço correspondente.

## Dados e validação

Um rascunho pertence à identidade Supabase autenticada que o criou. Não aceite um `user_id`, papel ou vínculo recebido do cliente como prova de autorização. O servidor deve validar novamente os valores e retornar erros por campo sem registrar o corpo em logs.

- `displayName`: nome informado, normalizado e sujeito a limites de tamanho definidos pelo produto.
- `sportIds`: identificadores estáveis do catálogo autorizado, sem duplicatas; de uma a cinco modalidades na conclusão. Validar os IDs no servidor, não apenas no navegador.
- `languages`: conjunto não vazio com `pt`, `en` e/ou `es`.
- `serviceModes`: conjunto não vazio com `presential` e/ou `online`; ambos podem coexistir.
- `city`: município identificado por código e UF, conferidos contra o catálogo oficial no servidor. Obrigatório quando `presential` está selecionado; opcional quando apenas `online` está selecionado. Texto livre não é município válido.
- `regions`: seleção opcional vinculada ao município escolhido e validada pelo servidor. Sem catálogo ou persistência configurados, não inventar opções nem confirmação de envio para revisão.

Geolocalização é uma sugestão opcional: negar permissão não bloqueia o fluxo. Não enviar ou armazenar coordenadas ou endereço exato para preencher este cadastro. A última cidade somente pode ser mostrada se houver uma escolha real associada à sessão/conta e o acesso tiver sido autorizado; não usar exemplos locais como histórico da pessoa.

## Autorização e privacidade

O desenho futuro deve usar Supabase Auth para validar a identidade da requisição e Supabase Postgres como fonte de verdade do rascunho e dos papéis concedidos. `user_metadata` é editável pelo usuário e não concede papel, propriedade, permissão de publicação nem acesso a outro treinador. Uma pessoa pode ter os papéis de treinador e aluno simultaneamente; adicionar ou escolher um contexto não remove o outro nem seus vínculos.

Ativar RLS nas tabelas expostas e definir privilégios por operação. Leitura e escrita de um rascunho devem exigir a identidade dona e autorização adequada para aquele objeto; uma política `TO authenticated` isolada é insuficiente. Não conceder acesso a outros treinadores. Uma operação futura que conceda papel ou altere mais de uma tabela deve verificar a autorização e confirmar suas alterações em uma transação; não ampliar privilégios ou criar função privilegiada apenas para contornar RLS. Qualquer função privilegiada necessária exige revisão separada de chamada direta, grants e concorrência.

Cadastro da conta, escolha de papel, rascunho, publicação e indexação são fatos distintos. Salvar um rascunho não o torna público, não o inclui na busca e não cria cobrança. Nenhuma contagem, proximidade ou revisão de cidade pode ser apresentada como real sem fonte e operação verificadas.

## Operações e concorrência a implementar

O contrato final deve oferecer leitura do próprio rascunho e gravação com versão de revisão ou mecanismo equivalente de concorrência. Uma resposta de gravação confirmada retorna a versão efetivamente persistida. Para alterações concorrentes, retornar conflito e preservar os campos locais, permitindo à pessoa carregar a versão atual e revisar/reaplicar explicitamente. Não sobrescrever outra edição silenciosamente.

Se a requisição for enviada mas a resposta se perder, o resultado é **não confirmado**, não uma falha definitiva. Preservar o que a pessoa digitou, orientar a conferir a versão atual e não repetir automaticamente. Uma futura chave de idempotência deve ser associada à operação e à identidade, com regras de retenção e reconciliação revisadas antes de uso.

Ao detectar logout, perda de sessão, troca de usuário ou de sessão, retirar imediatamente dados e callbacks da identidade anterior; não mostrar nem enviar o rascunho anterior sob a nova conta. Um refresh confirmado da mesma sessão não deve apagar campos ou foco. Qualquer persistência local de rascunho exige projeto explícito de isolamento e limpeza; a primeira versão pode manter o rascunho apenas em memória e informar que ele não sobrevive à saída ou ao recarregamento.

## Estados da interface

O mínimo para conectar uma implementação real é distinguir `indisponível`, `carregando`, `editando`, `salvando`, `salvo`, `conflito`, `resultado não confirmado`, `erro confirmado` e `sessão alterada`. `salvo` exige resposta ou leitura de confirmação do servidor. Em erro confirmado, permitir correção e nova tentativa manual; em resultado não confirmado, não fazer retry automático. A interface deve manter campos em erro/conflito, anunciar estados por região acessível e manter foco previsível sem removê-lo do contexto da pessoa.

Enquanto o endpoint estiver ausente, a ação de persistência deve permanecer indisponível com explicação clara. Não tratar `Pular` como rascunho salvo: se essa opção apenas deixa a tela, esclarecer a perda do conteúdo ainda não persistido.

## Verificação antes de conectar

1. Revisar migration própria e grants, sem alterar o schema Auth gerenciado. Conferir o projeto Supabase novo antes de qualquer aplicação.
2. Usar contas sintéticas distintas com JWTs reais nos papéis `anon` e `authenticated`: leitura/escrita próprias, ID de outra conta adulterado, treinador também aluno, papéis removidos/reconcedidos e tentativas de acesso cruzado. Não usar `service_role` como prova de RLS.
3. Testar duas edições simultâneas, conflito, resposta perdida, repetição manual, troca/logout de sessão com respostas atrasadas e preservação de foco em refresh da mesma sessão. Testar operações privilegiadas e revogação concorrente com banco real isolado.
4. Testar município inexistente/homônimo, UF incorreta, negação de localização, online sem cidade, presencial sem cidade, limite de modalidades, idiomas e regiões. Testar desktop/celular, teclado, erros e ausência de mensagens de sucesso simuladas.
5. Registrar a limpeza das fixtures, os testes realizados e o que ainda não está conectado. Não declarar integração funcionando a partir de dados de demonstração ou testes sintéticos.
