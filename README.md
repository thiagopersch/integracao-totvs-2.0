# Integração TOTVS RM

Painel administrativo enterprise para integração com **TOTVS RM** via **SOAP Dataserver**. Construído com **Next.js 16**, **React 19**, **TypeScript**, **Prisma ORM** e **PostgreSQL**.

## Stack

| Categoria | Tecnologia |
|-----------|-----------|
| Framework | Next.js 16 (App Router, Cache Components) |
| Frontend | React 19, TailwindCSS 4, Shadcn/UI |
| State | Zustand, TanStack Query, TanStack Table |
| Formulários | React Hook Form + Zod 4 |
| Backend | Server Actions, Route Handlers, Prisma ORM |
| Database | PostgreSQL 16 |
| SOAP | Axios + fast-xml-parser |
| Editor | CodeMirror 6 |
| Gráficos | Recharts |
| Autenticação | JWT + bcrypt + httpOnly cookies |
| Infra | Docker, Docker Compose |

## Começando

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- NPM

### 1. Clone e instale

```bash
git clone <repo-url>
cd integracao-totvs
npm install
```

### 2. Configure ambiente

```bash
cp .env.example .env
# Edite .env conforme necessário
```

### 3. Suba o banco de dados

```bash
docker compose up -d postgres
```

### 4. Execute migrations e seed

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Inicie o servidor

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Credenciais padrão

| Papel | E-mail | Senha |
|-------|--------|-------|
| Admin | admin@totvs.com.br | admin123 |
| Gerente | gerente@totvs.com.br | admin123 |
| Usuário | usuario@totvs.com.br | admin123 |

## Estrutura do Projeto

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, recovery
│   ├── (dashboard)/        # Admin, SOAP, Dashboard
│   ├── api/                # Route Handlers
│   ├── proxy.ts            # Next.js 16 Proxy (auth + security)
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Tailwind + Shadcn
├── actions/                # Server Actions
├── components/             # React Components
│   ├── ui/                 # Shadcn components
│   ├── shared/             # DataTable, Forms, EmptyState
│   └── soap/               # SOAP-specific components
├── services/               # Business logic
├── repositories/           # Data access (Repository Pattern)
├── lib/                    # Prisma, JWT, Logger, Encryption
├── schemas/                # Zod schemas
├── store/                  # Zustand stores
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript types
├── utils/                  # Utilities (cn, format, xml)
├── config/                 # Config (env, permissions, auth)
├── constants/              # Constants (roles, modules)
└── prisma/                 # Schema + Seed
```

## Funcionalidades

### Autenticação
- Login com JWT + refresh token
- httpOnly cookies
- RBAC (Admin, Manager, User)
- Troca obrigatória de senha
- Rate limiting

### CRUDs (9 entidades)
- Users, Dataservers, Process, Clients, TBCs, Filters, Backups, Sentence Categories, Sentences
- Server-side pagination, search, filter, sort
- Soft delete + restore
- Bulk actions
- Export CSV/XLSX
- TanStack Table com colunas configuráveis

### Integração SOAP
- Builder visual com CodeMirror 6
- Suporte: GETSCHEMA, READRECORD, READVIEW, SAVERECORD
- Editor XML/JSON com conversão automática
- Console técnico (Request, Response, Headers, Timing)
- Histórico de chamadas
- Templates e favoritos
- Retry automático (3 tentativas, backoff)
- Timeout configurável
- Copy/Download XML

### Dashboard
- Métricas em tempo real
- Gráfico de integrações (7 dias)
- Últimas execuções SOAP
- Taxa de sucesso, falhas, tempo médio

### Segurança
- Senha de usuário com hash bcrypt (custo 12); sessões abertas antes de uma troca/reset de senha são invalidadas
- Senhas de TBC (TOTVS RM) e SMTP criptografadas em repouso com AES-256-GCM (`lib/secret-box.ts`), descriptografadas só em memória no envio ao RM/SMTP e nunca retornadas ao front
- Toda Server Action e Route Handler valida sessão e permissão no próprio servidor
- Rate limiting por usuário/IP e por conta no login
- Headers de segurança (CSP `frame-ancestors`, X-Frame-Options, HSTS em produção) em todas as rotas
- Auditoria de todas as ações
- Validação server-side obrigatória (Zod)

#### Chave de criptografia de credenciais (`CREDENTIALS_ENCRYPTION_KEY`)

Obrigatória para cadastrar/alterar senhas de TBC e SMTP. Gere uma vez por ambiente e guarde em local seguro:

```bash
openssl rand -base64 32
```

> ⚠️ **Perder a chave obriga a redigitar todas as senhas de TBC e SMTP.** Não troque a chave de um ambiente que já tem senhas criptografadas.

Senhas antigas em texto puro continuam funcionando; para criptografá-las (idempotente, com verificação antes de gravar):

```bash
npx tsx scripts/encrypt-credentials.ts --dry-run
npx tsx scripts/encrypt-credentials.ts
```

Veja o passo a passo completo em [docs/auditoria-2026-10.md](docs/auditoria-2026-10.md).

## Scripts

```bash
npm run dev              # Desenvolvimento
npm run build            # Build produção
npm run start            # Iniciar produção
npm run lint             # ESLint
npm run format           # Prettier

npm run prisma:migrate   # Rodar migrations
npm run prisma:seed      # Seed banco
npm run prisma:generate  # Gerar Prisma Client
npm run prisma:studio    # Prisma Studio
```

## Docker

```bash
# Subir tudo
docker compose up -d

# Apenas banco
docker compose up -d postgres

# Logs
docker compose logs -f app
```

## Licença

MIT
