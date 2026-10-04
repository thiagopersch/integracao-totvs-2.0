# Auditoria — loading, performance, responsividade e segurança (out/2026)

Este relatório cobre as quatro frentes pedidas:

1. Loading por componente.
2. Gargalos de navegação e desempenho.
3. Responsividade.
4. Segurança, com foco na senha do TBC.

Para cada frente há o que foi encontrado, o que foi corrigido e o que ficou pendente (com o motivo).

**Validação, resumida aqui e detalhada na seção 5:**
- `tsc` sem erros.
- 57 testes passando (incluem os novos de criptografia e de XSS).
- `next build` sem erros.
- ESLint: 3 erros já existentes, em arquivos não tocados.
- As 35 rotas verificadas no navegador, em 375 px e 768 px.

---

## 1. Loading por componente

### Problema

Os dados vêm de Server Components que leem os `searchParams` da URL. Período, busca, filtros, paginação e ordenação faziam `router.push`, e salvar/excluir fazia `router.refresh()`, sem acompanhar a transição. O resultado era a tela "congelada", sem nenhum indício de que algo estava carregando.

Além disso, a troca de período chamava uma Server Action que gravava um cookie, e isso disparava uma segunda renderização do servidor a cada troca.

### Solução

| Peça | Arquivo |
|---|---|
| Região "recarregando" (conteúdo atual esmaecido + spinner, `aria-busy`) | [components/shared/pending-region.tsx](../components/shared/pending-region.tsx) |
| Hook de navegação com `useTransition` (`pushParams`, `refresh`, `isPending`) | [hooks/use-url-params.ts](../hooks/use-url-params.ts) |
| `useCrudTable` passa a usar o hook e expõe `isPending`/`refresh` | [hooks/use-crud-table.ts](../hooks/use-crud-table.ts) |
| `usePeriodFilter`: período otimista (o select muda na hora), `isPending`, cookie gravado no cliente (sem a 2ª renderização) | [hooks/use-period-filter.ts](../hooks/use-period-filter.ts) |
| `DataTable` ganha `refreshing`: a tabela e a paginação esmaecem, o toolbar continua utilizável | [components/shared/data-table.tsx](../components/shared/data-table.tsx) |

**Onde foi aplicado:**
- Todas as tabelas CRUD (cerca de 20).
- Tabelas de atividades, notificações, backups (sentenças e histórico), favoritos e templates SOAP.
- Resposta do SOAP Builder e bloco de relatórios TBC.
- Dashboard: **somente os cards que dependem do período** entram em loading:
  - integrações, taxa de sucesso, falhas, tempo médio e performance;
  - consumo de contratos;
  - gráficos de integrações e de demandas;
  - ranking.

  Clientes, TBCs e usuários não mudam com o período e ficam intactos.

**Bug corrigido de passagem:** em desenvolvimento, a busca do toolbar disparava uma navegação extra (`?page=1`) toda vez que uma tabela carregava (efeito duplo do StrictMode) ([data-table-toolbar.tsx](../components/shared/data-table-toolbar.tsx)).

---

## 2. Performance

### Corrigido

| # | Gargalo | Correção |
|---|---|---|
| 1 | **Sessão relida do banco em toda requisição.** Cerca de 6 queries × cada request, inclusive prefetch de links, server actions e arquivos estáticos. `/demands` disparava ~60 queries só de sessão. | `jwt` relê papel, permissões e clientes no máximo a cada 60 s (`SESSION_REFRESH_INTERVAL_MS`), numa única query. `getRequestContext` memoizado por request (`cache`). Escopo de analista memoizado. |
| 2 | `proxy.ts` passava logos, uploads e SVGs por autenticação + banco + rate limit. | O matcher exclui arquivos estáticos. O rate limit passa a ser por usuário (não mais por IP compartilhado `"unknown"`/NAT) e ignora prefetch. |
| 3 | Dashboard: logs recentes traziam o XML completo de cada chamada SOAP; agrupamento diário retornava uma linha por log; queries duplicadas; 5 buscas sequenciais. | `select` só dos campos exibidos; `date_trunc('day')` no banco (resultado conferido igual ao anterior); query duplicada removida; buscas em paralelo. |
| 4 | Cada chamada SOAP invalidava o cache do dashboard com `expire: 0`, então a próxima visita esperava todas as ~20 queries. | `revalidateTag("dashboard", "max")`: stale-while-revalidate, como recomenda o Next 16. |
| 5 | **Nenhum índice** nas tabelas mais consultadas (o Postgres não indexa FKs). | Migração `20261004145209_add_performance_indexes` com 17 índices: logs por `(organization_id, created_at)`, demandas, notificações, backups, filtros (scheduler) e contratos. |
| 6 | `distinct` do Prisma (sem `nativeDistinct`) carrega todas as linhas e deduplica no Node. Isso acontecia em tabelas de log, em toda carga de `/admin/activity`. | Trocado por `groupBy` (SQL `GROUP BY`) nas atividades e nas opções de filtro de demandas. |
| 7 | Feed de atividades enviava `xmlResponse`/`jsonResponse` (um ReadView pode ter MBs) de todas as linhas. | Removidos da listagem; carregados sob demanda ao abrir o detalhe (`getActivitySoapResponse`). |
| 8 | Bundles pesados carregados de forma estática. | Sob demanda: editor CodeMirror (7 linguagens + sql-formatter), exportação PDF de demandas (jspdf + html-to-image), exportação DOCX (ps-docs), PDF do protótipo, recharts no dashboard. |
| 9 | React Query instalado e montado, mas nunca usado. | Removidos o provider e o pacote. |
| 10 | Fontes: Poppins com 5 pesos, Orbitron com 5 pesos (só o logo usa) e JetBrains pré-carregada em todas as páginas. | Só os pesos usados; JetBrains sem preload. |
| 11 | Pool do Postgres com 10 conexões para cerca de 20 queries paralelas no dashboard. | `DATABASE_POOL_MAX` (padrão 20). |
| 12 | Skeleton de tabela usado no dashboard. | `DashboardSkeleton` no formato da página. |

### Pendente (decisão consciente)

- **Layout `(dashboard)` como Server Component:** evitaria o sidebar vazio no primeiro carregamento. Não foi feito porque, com `cacheComponents`, ler a sessão no layout torna todas as páginas dinâmicas e elimina o shell estático da navegação instantânea. O custo que motivava a mudança (sessão a cada request) já foi resolvido no item 1.
- **Handshake SOAP:** cada chamada faz `AutenticaAcesso` → `CheckServiceActivity` → chamada real, com timeout de 30 s × 3 tentativas. Um cache do handshake ou do GetSchema reduziria a latência, mas mexe na autenticação no RM e precisa ser validado com vocês.
- **`contract.service.list`:** faz um `updateMany` (expirar contratos) dentro de uma leitura cacheada e pagina em memória na visão padrão. Tirar a escrita de lá muda quando o status "Expirado" aparece; precisa de decisão de produto.
- **`backup.service.createFromFilter`:** faz um `findFirst`/`update`/`create` por sentença (N+1). Dá para fazer em lote, mas é o caminho de gravação de backup e merece testes próprios antes.
- **Listagem de backups:** envia o SQL completo das 10 sentenças da página (`contentSentence`). Impacto baixo.

---

## 3. Responsividade

Verificado no navegador, rota por rota, em **375 px** (celular) e **768 px** (tablet). O critério foi que nenhum elemento ultrapassasse a largura da tela fora de áreas com scroll próprio, como as tabelas.

**Componentes compartilhados (corrigem várias telas de uma vez):**
- **Layout:**
  - `h-dvh` (evita o salto da barra de endereço no iOS).
  - Botão de menu mobile dentro do header (antes flutuava sobre o conteúdo).
  - Header compacto no celular.
  - Drawer limitado a 85vw.
- **Abas (`TabsList`):** rolam lateralmente quando não cabem, em vez de vazar.
- **Toolbar das tabelas:** botões de ação quebram linha.
- **Seletor de itens por página:** largura fluida.
- **Sino de notificações:** popover `w-[calc(100vw-2rem)]` no celular (antes 384 px fixos).
- **Gráficos:** cabeçalho dos cards quebra linha, seletor de tipo mais estreito e eixo Y menor no celular.
- **Padding das páginas:** `p-4 md:p-6` (34 arquivos).

**Por página:**
- Formulários com grids fixos de 2/3 colunas passam a usar 1 coluna no celular: analistas, contratos, filtros, notificações, editor de tema e checklist.
- **Checklist do TBC:** sidebar e conteúdo empilham abaixo de `lg`; corrigido também o scroll duplo causado por `100vh - 4rem`.
- **Backups do filtro:** a expressão longa do filtro quebra linha.
- **SOAP Builder:** cabeçalho quebra linha.
- **Mapeador:** cabeçalho com nome e abas cabe na tela; o frame "mobile" do protótipo respeita `max-w-full`.
- **Builder de templates:** campos com largura total no celular.
- **Preview do protótipo:** `h-dvh`.

`/admin/roles`, `/admin/soap-endpoints` e `/admin/users` exigem permissões que o usuário de teste não tem. Foram revisadas no código: usam os mesmos componentes compartilhados corrigidos e grids responsivos.

---

## 4. Segurança

### Senha do TBC (TOTVS RM): como foi tratada

O RM exige a senha original no header HTTP Basic, então **hash não serve**: a criptografia precisa ser reversível.

**Algoritmo e formato:**
- AES-256-GCM, em [lib/secret-box.ts](../lib/secret-box.ts). É autenticado: um valor adulterado, ou cifrado com outra chave, falha em vez de virar uma senha errada.
- Formato armazenado: `enc:v1:<iv>:<tag>:<cifra>`. O `v1` permite rotacionar a chave no futuro.

**Onde ela é descriptografada:**
- Num único ponto: `soapService.dispatch`, só em memória, no instante de montar o header para o RM. Isso cobre TBC, backups, sentenças, relatórios, checklist e "Testar conexão".
- A senha do SMTP segue o mesmo esquema, descriptografada em `lib/mailer.ts`.

**Compatibilidade:** valores sem o prefixo `enc:` (legado em texto puro) continuam funcionando. O deploy não quebra nenhuma integração mesmo antes da migração.

**Migração:** [scripts/encrypt-credentials.ts](../scripts/encrypt-credentials.ts).
- É idempotente.
- Tem `--dry-run`.
- Criptografa, descriptografa de volta e compara antes de gravar; qualquer divergência aborta tudo.
- Roda numa única transação e nunca imprime senhas.

**Validado no banco local:**
1. Os 2 TBCs autenticaram no RM com a senha em texto puro.
2. A migração rodou.
3. Os 2 TBCs autenticaram de novo, agora com a senha criptografada.
4. Rodar a migração outra vez encontra 0 pendentes.

**Testes:** [lib/secret-box.test.ts](../lib/secret-box.test.ts).
- Caracteres especiais e unicode.
- Legado em texto puro.
- Adulteração.
- Chave errada.
- Chave ausente.

### Achados e status

| Sev. | Achado | Status |
|---|---|---|
| Crítico | Senha do TBC e do SMTP em texto puro no banco | ✅ Criptografadas (acima) |
| Crítico | `/admin/backups/[id]` enviava a **senha do TBC** ao navegador (`include: { tbc: true }`) | ✅ `select` sem senha (verificado no payload) |
| Crítico | Ações de Endpoints SOAP (configuração global de todas as organizações) **sem nenhuma checagem**, chamáveis sem login | ✅ `settings:manage` em todas as escritas |
| Alto | Troca de senha usava o `userId` enviado pelo cliente: dava para testar e trocar a senha de qualquer usuário | ✅ Usuário vem da sessão; política de senha validada no servidor; rate limit |
| Alto | Hash bcrypt dos usuários enviado ao navegador | ✅ `omitPassword` no `userService`; `omit` no perfil |
| Alto | ~35 leituras cacheadas exportadas como Server Actions, confiando em `organizationId` recebido por argumento (leitura entre organizações) | ✅ Movidas para `queries/`, módulos sem `"use server"`, que deixam de ser endpoints |
| Alto | Filtros e ordenação genéricos aceitavam objetos/campos arbitrários (ex.: `password` com `startsWith`, ordenar por `password`) | ✅ Filtros só com valores primitivos; ordenação por allowlist (`lib/sort.ts`) |
| Alto | `/api/soap/*` sem checagem de permissão; `/api/soap/tbcs` ignorava o escopo de clientes | ✅ `soap:execute` obrigatório; escopo aplicado |
| Alto | Trocar o link de um TBC enviava a senha salva para o novo host | ✅ Mudar o link exige redigitar a senha (front + service) |
| Alto | Rate limit do login com chave fixa (um atacante bloqueava todos) e contornável via `/api/auth/callback` | ✅ Por IP+e-mail no `loginAction` e por conta no `authorize` |
| Médio | Usuário desativado ou com senha trocada mantinha a sessão por até 7 dias | ✅ Sessões rejeitadas no próximo refresh (≤ 60 s): coluna `password_changed_at` + `authAt` no token. Trocar a própria senha encerra a sessão e leva ao login. |
| Médio | Tempo de resposta do login revelava se um e-mail existe | ✅ bcrypt fictício para e-mails inexistentes |
| Médio | XSS armazenado nos templates de mensagem (sanitizador por regex contornável) | ✅ Sanitizador por allowlist (testado contra 8 bypasses) + DOMPurify no navegador (canvas, preview, ps-docs) |
| Médio | Quem tem só `users:update` podia resetar a senha de um ADMIN (e recebe a senha temporária) ou promover alguém a ADMIN | ✅ Só ADMIN gerencia ADMIN |
| Médio | Senha temporária gerada com `Math.random()` | ✅ `crypto.randomInt` |
| Médio | `setUserClients` podia alterar usuário de outra organização | ✅ Valida a organização |
| Médio | A senha exigida para restaurar backup só era checada pela interface | ✅ Checada dentro de cada ação de restore, com rate limit |
| Médio | Sem CSP/HSTS; `/login` podia ser embutida em iframe (clickjacking) | ✅ Headers em todas as rotas (`next.config.ts`) |
| Médio | SSRF / `file://` (teste de TBC, ficha PS, Playwright) | ✅ Só `http(s)`. ⚠️ IPs privados **não** são bloqueados, de propósito: TBCs on-premise ficam em rede interna (risco aceito) |
| Baixo | Injeção de `;` no `Contexto` SOAP | ✅ Separadores removidos dos valores |
| Baixo | Leituras de backup sem escopo de cliente (código morto) | ✅ Removidas |

### Pendente (precisa da sua decisão)

- **`xlsx` 0.18.5** tem CVEs (prototype pollution e ReDoS) e é usado para ler arquivos enviados. O pacote no npm foi abandonado; a versão corrigida está apenas no CDN oficial do SheetJS:

  ```bash
  npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  ```

  Não troquei a origem da dependência sem sua confirmação.
- **Seed:** `admin@totvs.com.br` / `admin123` é criado com `changePassword: false`. O seed apaga o banco, então só roda em dev, mas convém forçar a troca no primeiro login.
- **Upload de SVG** em logos: aceito apenas pelo MIME informado. Em produção vai para o Vercel Blob (outro domínio, risco baixo). Em dev é servido pela própria origem.
- **TPI** permite desligar a verificação TLS e envia a senha na query string. Depende da API do parceiro.
- **Rotação de chave:** o formato `enc:v1` já prevê; falta o script de rotação.

---

## 5. Runbook — deploy desta versão

1. **Gerar a chave** (uma vez por ambiente) e configurar `CREDENTIALS_ENCRYPTION_KEY`, na Vercel ou no `.env` do docker:

   ```bash
   openssl rand -base64 32
   ```

   Guarde-a em um cofre de senhas. **Perder a chave obriga a redigitar todas as senhas de TBC e SMTP.**
2. **Deploy.** O `npm run build` já aplica as 2 migrações novas:
   - `password_changed_at`;
   - os 17 índices.

   Em tabelas de log grandes, a criação dos índices pode levar alguns segundos.
3. **Backup do banco.**
4. Em `/admin/tbcs`, clique em **Testar conexão** em um TBC real. É a linha de base.
5. Rode a simulação e confira a lista:

   ```bash
   npx tsx scripts/encrypt-credentials.ts --dry-run
   ```

6. Rode a migração:

   ```bash
   npx tsx scripts/encrypt-credentials.ts
   ```

7. **Testar conexão** de novo no mesmo TBC. Deve dar o mesmo resultado.

**Efeitos visíveis para os usuários:**
- Mudanças de papel, permissão ou clientes passam a valer em até **60 s** (antes era imediato).
- Trocar a própria senha encerra a sessão e pede um novo login.
- Senhas resetadas pelo admin derrubam as sessões abertas daquele usuário.

### Checagens executadas

- `npx tsc --noEmit`: sem erros.
- `npx vitest run`: 57/57.
- `npx next build`: sem erros.
- `npx eslint .`: 3 erros já existentes (login, reset-password, restore-backup-dialog), em arquivos não alterados.
- Navegador:
  - Loading por card no dashboard e por tabela em demandas e atividades.
  - Sessão renovando a cada 60 s.
  - 401 nas rotas SOAP sem sessão.
  - Headers presentes em `/login`.
  - 35 rotas em 375 px e 768 px.
