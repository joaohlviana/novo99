# Onboarding de treinador — candidato para revisão

Esta branch prepara a interface e o contrato, sem habilitar persistência, catálogo de municípios, Meilisearch ou geolocalização real. A rota `/onboarding/treinador` exige sessão verificada; não concede ou verifica papel de treinador e não lê dados privados de treinador. O formulário mantém apenas rascunho em memória. Salvar e Pular permanecem indisponíveis; não há alegação de gravação, revisão de município enviada ou publicação.

A interface oferece oito modalidades iniciais, limite de cinco, dois modos de atendimento, cidade normalizada quando uma fonte real estiver ligada, regiões opcionais e idiomas. Busca de modalidades e cidades exige fontes injetadas e permanece indisponível nesta branch. Nenhum dado sintético do teste é usado pela rota. O escopo do rascunho é isolado por usuário e sessão, não por versão de papel ainda inexistente. Testes de sessão real e RLS são necessários antes de conectar persistência.

Os testes de navegador usam uma fixture separada, dados sintéticos e salvamento que falha. As capturas geradas são da implementação, não da referência; sem comparação visual com as pranchas e validação de teclado/leitor de tela, não declarar paridade integral. A prancha independente completa de Componentes-16 não foi recuperada. O catálogo Meilisearch, localização, municípios, indexação, Supabase RLS, consentimentos e fluxos reais ainda não foram validados aqui.

**Proteção de revisão:** `vercel.json` nesta branch contém `ignoreCommand: exit 0` para impedir builds automáticos da candidata enquanto a revisão está pendente. Remover esse arquivo ou ajustar a política explicitamente antes de qualquer merge ou publicação; mantê-lo em main impediria builds futuros. Nenhuma migration foi criada ou executada por esta entrega.

Revisão de sessão: o formulário é ocultado durante uma verificação que falha, porém pode permanecer no DOM em memória para preservar um refresh da mesma sessão. Uma troca de cookie fora do SDK pode não ser detectada imediatamente. Portanto, a branch não comprova limpeza integral ou isolamento por papel e não pode conectar escrita de perfil antes de revisão e testes reais.
