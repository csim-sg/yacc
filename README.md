# YACC - Yet Another Chat Client

A single-tenant, cloud-hosted omni-channel social inbox that unifies Telegram, IRC, and other social platforms into one workflow. The MVP focuses on unified inbox operations, role-based access, and extensible connector integrations built with React + TanStack Start + Express.

**Status**: ✅ Monorepo setup complete | 🚀 Ready for Phase 1 implementation

---

## 🚀 Quick Start (5 minutes)

### Prerequisites

```bash
# Node.js v18 or higher
node --version

# pnpm v9 (if not installed: npm install -g pnpm@9)
pnpm --version

# Docker (for local database/services)
docker --version
```

### Installation & Setup

```bash
# 1. Clone repository
git clone https://github.com/antpolis/yacc-client.git
cd yacc-client

# 2. Install dependencies (all workspaces)
pnpm install

# 3. Start local services (PostgreSQL, Redis, Mailhog)
docker-compose up -d

# 4. Setup environment files
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# 5. Start development servers (all packages)
pnpm dev

# 6. Open in browser
# Frontend: http://localhost:5173
# Backend:  http://localhost:3000/api
# Mailhog:  http://localhost:1025 (email testing)
```

### Package Manager: pnpm

This project uses **pnpm** for monorepo management with workspaces. pnpm offers:

- ✅ **Faster**: 2-3x faster than npm
- ✅ **Disk efficient**: Content-addressable storage (symlinks)
- ✅ **Strict mode**: Prevents phantom dependencies
- ✅ **Monorepo support**: Native workspace integration

All commands in this README use `pnpm`. If you don't have it:

```bash
npm install -g pnpm@9
```

---

## 📦 Project Structure

```
yacc-client/
├── packages/
│   ├── common/          # Shared types, schemas, constants, utils
│   ├── backend/         # Express API server
│   │   ├── src/
│   │   │   ├── api/            (controllers, routes)
│   │   │   ├── domain/         (services, business logic)
│   │   │   ├── connectors/     (Telegram, IRC)
│   │   │   ├── infrastructure/ (database, queue, storage)
│   │   │   └── config/
│   │   └── Dockerfile
│   │
│   └── frontend/        # React SPA
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── stores/      (Zustand state)
│       │   ├── services/    (API clients)
│       │   └── hooks/
│       ├── public/
│       └── vite.config.ts
│
├── .github/
│   └── workflows/       # CI/CD (GitHub Actions)
│       ├── lint.yml
│       ├── tests.yml
│       ├── backend-deploy.yml
│       └── frontend-deploy.yml
│
├── .docs/              # Product specs & detailed docs
├── docker-compose.yml  # Local dev environment
├── turbo.json          # Monorepo task orchestration
└── pnpm-workspace.yaml # Workspace configuration
```

---

## 💡 Common Commands

### Development
```bash
pnpm dev              # Start all servers (frontend + backend)
pnpm dev --filter @yacc/backend   # Backend only
pnpm dev --filter @yacc/frontend  # Frontend only
```

### Building
```bash
pnpm build            # Build all packages
pnpm build --filter @yacc/frontend  # Frontend only
```

### Testing & Quality
```bash
pnpm test             # Run all tests
pnpm test --filter @yacc/frontend   # Frontend E2E tests
pnpm lint             # Lint code
pnpm type-check       # TypeScript type checking
```

### Database
```bash
pnpm db:migrate       # Run migrations
pnpm db:seed          # Add test data
```

### Cleanup
```bash
pnpm clean            # Remove build artifacts
```

---

## 📝 Before Committing

**Checklist:**
```bash
pnpm lint:fix         # Fix linting issues
pnpm type-check       # Check TypeScript
pnpm test:unit        # Run tests
git add .
git commit -m "feat(backend): add new endpoint"
```

**Commit Format:**
```
feat(backend):      new feature
fix(frontend):      bug fix
docs:               documentation
refactor(backend):  code cleanup
test(frontend):     add tests
```

---

## 🔍 Debugging

### Backend
```bash
NODE_OPTIONS=--inspect pnpm dev --filter @yacc/backend
# Then open chrome://inspect in Chrome
```

### Frontend
```bash
pnpm dev --filter @yacc/frontend
# Use browser DevTools (F12 → Sources)
```

### Database
```bash
psql -U yacc_user -d yacc_db -h localhost
docker-compose logs -f postgres
```

---

## 📊 Useful Links

| Resource | URL |
|----------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:3000/api |
| **Email UI (Mailhog)** | http://localhost:8025 |

---

## ❓ Troubleshooting

### Port 3000/5173 already in use
```bash
lsof -i :3000
kill -9 <PID>
```

### PostgreSQL won't connect
```bash
docker-compose ps
docker-compose restart postgres
docker-compose logs -f postgres
```

### "Cannot find module" error
```bash
pnpm install
pnpm store prune
```

### TypeScript errors in IDE
```
Ctrl+Shift+P → "Developer: Reload Window" (in VSCode)
```

---

## 🛠️ pnpm Monorepo Commands

```bash
# Install dependencies (all packages)
pnpm install

# Add package to root (dev dependency)
pnpm add -w -D eslint

# Add package to specific package
pnpm add axios --filter=backend

# Run script in specific package
pnpm -F backend test

# Run script in all packages
pnpm -r test

# List all workspaces
pnpm ls --depth=-1
```

---

## 🚀 Deployment

### Backend to VPS
```bash
# Automatic on push to main
# Uses .github/workflows/backend-deploy.yml
# Builds Docker image → Pushes to registry → SSH deploy to VPS
```

### Frontend to AWS S3
```bash
# Automatic on push to main
# Uses .github/workflows/frontend-deploy.yml
# Builds React app → Uploads to S3 → Invalidates CloudFront
```

**Required GitHub Secrets** (in Settings → Secrets):
- Backend: `DOCKER_REGISTRY`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `VPS_SSH_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY`
- Frontend: `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_CLOUDFRONT_DISTRIBUTION_ID`

---

## 💡 Tips & Tricks

1. **Faster builds:** Turborepo caches results. Unchanged packages don't rebuild.
2. **IDE autocomplete:** Make sure TypeScript is selected as language in VSCode.
3. **Hot reload:** Both backend and frontend support hot reloading.
4. **Parallel execution:** Turbo runs tasks in parallel when possible.
5. **Dry run:** `pnpm dev --dry` shows what Turbo will execute without running.

---

## 📚 Documentation

### Quick Start
- **This file (README.md)** - Getting started guide
- **AGENTS.md** - Team roles and responsibilities

### Architecture & Design
- **ARCHITECTURE_AND_IMPLEMENTATION.md** - System architecture, technical decisions, and data flows
- **DEVELOPMENT.md** - Detailed local setup guide

### Product & API
- **.docs/01-product-specification.md** - Features, user stories, acceptance criteria
- **.docs/02-api-and-data-model.md** - API contract and database schema
- **.docs/04-qa-and-testing.md** - Testing strategy and test cases
- **.docs/05-quick-reference.md** - One-page MVP summary

---

## 🤝 Contributing

### Development Workflow
1. Clone the repository
2. Run `pnpm install`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make changes and commit: `git commit -m "feat: description"`
5. Push to your fork and create a Pull Request

### Code Standards
- Use TypeScript for all new code
- Follow the monorepo structure (common for shared code)
- Run `pnpm lint` before committing
- Add tests for new features
- Update documentation as needed

### Setting Up Local Development
```bash
# Start all services
docker-compose up -d

# Start development
pnpm dev
```

See [AGENTS.md](./AGENTS.md) for role-specific guidelines.

---

## 📋 Tech Stack

### Frontend
- **Framework**: React 18 + TanStack Start (SPA)
- **State**: Zustand + TanStack Query
- **Real-time**: Socket.io client
- **Styling**: Tailwind CSS
- **Deployment**: AWS S3 + CloudFront

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express
- **Auth**: BetterAuth
- **Database**: PostgreSQL + Drizzle ORM
- **Real-time**: Socket.io
- **Queue**: Redis + BullMQ (message retry)
- **Storage**: AWS S3 / Cloudflare R2
- **Testing**: Jest + Playwright

### Local Development
- **Package Manager**: pnpm
- **Build Tool**: Turborepo
- **Containerization**: Docker + Docker Compose

---

## 📄 License
MIT — see `LICENSE`
