# VFINAL: verificação isolada de interface

`vfinal.e2e.mjs` monta um componente real em uma rota adicionada **apenas a uma cópia temporária** da aplicação. O componente não é adicionado a nenhuma rota publicada. O lookup de município é sintético; o salvamento injetado sempre falha e jamais declara sucesso. Não usa contas, rede externa, Supabase ou dados de pessoas.

Em um runner com as dependências do app, Playwright e Chromium já instalados, execute na raiz:

```sh
VFINAL_SCREENSHOT_DIR=vfinal-screenshots node tests/browser/vfinal.e2e.mjs
```

O script constrói a cópia, restringe o navegador a loopback, verifica ausência de overflow, largura e raio do cartão nas larguras 320, 390, 599, 600, 768 e 1440, além das opções comuns, idiomas e localização do rodapé. Captura PNGs da interface sintética em 320, 390, 768 e 1440. Em 390 exercita seleção máxima, busca de modalidades e município sintéticas, modos de atendimento, cidade obrigatória, homônimos de UF, Escape/setas/Enter, idiomas, falha de persistência troca de escopo e novo render sintético com o mesmo escopo. O novo render não simula refresh de autenticação. O teste não garante isolamento de sessão real; o escopo é sintético.

Os PNGs são capturas da implementação, **não** das fontes privadas. É necessário comparar com capturas autorizadas da referência na mesma largura, conferir fontes reais, estado e composição. O teste não substitui leitor de tela, auditoria de contraste, inspeção visual, permissão negada de geolocalização, foco ao sair de modal, alteração de sessão ou prova de persistência real. Nenhum dos testes acessa o novo Supabase ou prova que um rascunho foi salvo. Este roteiro não foi executado no ambiente onde foi preparado; seus resultados dependem do runner.
