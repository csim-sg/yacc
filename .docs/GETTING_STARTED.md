# YACC - Getting Started Guide

**Quick setup guide for new developers joining the project.**

---

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- Git

---

## 1. Clone & Install

```bash
# Clone repository
git clone <repository-url>
cd yacc-client

# Install dependencies
pnpm install
```

---

## 2. Start Infrastructure

```bash
# Start Postgres, Redis, and MailHog
docker compose up -d

# Verify services are running
docker compose ps

# Expected output:
# yacc-client-postgres-1   Up (healthy)
# yacc-client-redis-1      Up (healthy)
# yacc-client-mailhog-1    Up
```

---

## 3. Configure Environment

```bash
# Backend environment
cd packages/backend
cp .env.example .env

# Edit .env if needed (defaults are fine for local dev)
# Key variables:
# - BETTER_AUTH_SECRET (change in production!)
# - DB_* (database connection)
# - ACCESS_TOKEN_TTL_SECONDS (48 hours default)
# - REFRESH_TOKEN_TTL_SECONDS (30 days default)
```

---

## 4. Start Backend

```bash
# From packages/backend directory
npm run dev

# Expected output:
# ✅ Database connected
# 🔄 Starting database migrations...
# ✅ All tables created successfully
# 🌱 Seeding database...
# ✅ Database migrations completed successfully
# 🚀 Server running on port 3000
```

**Backend is now running at:** http://localhost:3000

---

## 5. Test Backend API

```bash
# Health check
curl http://localhost:3000/health

# Login as admin
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yacc.local",
    "password": "admin123"
  }'

# Expected response:
# {
#   "user": { "id": 30, "email": "admin@yacc.local", ... },
#   "session": { ... }
# }
# Headers:
#   set-auth-token: <JWT_ACCESS_TOKEN>
#   set-cookie: better-auth.refresh_token=<REFRESH_TOKEN>; HttpOnly
```

---

## 6. Start Frontend (Optional)

```bash
# From root directory
cd packages/frontend
npm run dev

# Frontend will start at: http://localhost:5173
```

**Note:** Frontend auth integration is pending (dev-7). You can access the UI but login won't work until frontend auth client is implemented.

---

## 7. Access MailHog (Email Testing)

**Web UI:** http://localhost:8025

MailHog captures all emails sent by the backend (password reset, notifications, etc.)

---

## 8. Database Access

**Via Docker:**
```bash
docker exec -it yacc-client-postgres-1 psql -U yacc_user -d yacc_inbox
```

**Direct connection:**
- Host: localhost
- Port: 5432
- Database: yacc_inbox
- User: yacc_user
- Password: yacc_password

**Common queries:**
```sql
-- List all users
SELECT id, email, name, role, status FROM users;

-- List conversations
SELECT id, channel, status, priority, assigned_user_id FROM conversations LIMIT 10;

-- Check tables
\dt

-- Describe table
\d users
```

---

## 9. Default Credentials

**Super Admin:**
- Email: `admin@yacc.local`
- Password: `admin123`
- Role: `super_admin`

⚠️ **Change password on first login in production!**

---

## 10. Common Tasks

### Reset Database
```bash
# Drop all data (WARNING: destructive!)
docker exec yacc-client-postgres-1 psql -U yacc_user -d yacc_inbox -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restart backend to re-run migrations
cd packages/backend
npm run dev
```

### Re-seed Admin User
```bash
cd packages/backend
npm run db:seed
```

### Stop All Services
```bash
docker compose down
```

### View Logs
```bash
# Backend logs
cd packages/backend
npm run dev

# Docker logs
docker compose logs -f postgres
docker compose logs -f redis
```

---

## 11. Project Structure

```
yacc-client/
├── packages/
│   ├── backend/          # Node.js API (Express + routing-controllers)
│   │   ├── src/
│   │   │   ├── api/      # Controllers & middleware
│   │   │   ├── domain/   # Services & business logic
│   │   │   └── infrastructure/  # Database, auth, external services
│   │   └── scripts/      # Utility scripts (seed, migrations)
│   ├── frontend/         # React SPA (TanStack Start)
│   └── common/           # Shared types & schemas
├── .docs/                # Project documentation
└── docker-compose.yml    # Infrastructure services
```

---

## 12. Development Workflow

1. **Check todo list:** `.docs/phases/PHASE1_TODO.md`
2. **Pick a task:** Start with high-priority pending tasks
3. **Read relevant docs:**
   - API spec: `.docs/02-api-and-data-model.md`
   - Implementation guide: `.docs/03-implementation-guide.md`
4. **Make changes:** Follow existing patterns (routing-controllers, services, etc.)
5. **Test manually:** Use curl or Postman
6. **Commit:** Clear commit messages following convention

---

## 13. Next Steps (For New Developers)

### Immediate Priority: Frontend Auth Integration (dev-7)

1. Install BetterAuth client in frontend
2. Create auth service/hook to manage token storage
3. Implement login flow:
   - Extract access token from `set-auth-token` header
   - Store in memory or localStorage
   - Attach `Authorization: Bearer {token}` to API calls
4. Implement auto-refresh on 401 (refresh token sent via cookie)
5. Test login → inbox flow

**Reference:** `.docs/SESSION_SUMMARY.md` for detailed next steps

---

## 14. Troubleshooting

### Backend won't start
- Check Docker containers: `docker compose ps`
- Check database connection: `docker compose logs postgres`
- Verify .env file exists and has correct values

### Database connection error
- Ensure Postgres container is running: `docker compose up -d postgres`
- Check credentials in `.env` match `docker-compose.yml`
- Wait 5-10 seconds for Postgres to be ready after starting

### Migration errors
- Drop and recreate database (see "Reset Database" above)
- Check migration script: `packages/backend/src/infrastructure/db/migrations.ts`

### Port already in use
- Backend (3000): `lsof -ti:3000 | xargs kill -9`
- Frontend (5173): `lsof -ti:5173 | xargs kill -9`
- Postgres (5432): Stop Docker container or change port in docker-compose.yml

---

## 15. Additional Resources

- **Session Summary:** `.docs/SESSION_SUMMARY.md` - Detailed progress report
- **Phase 1 Summary:** `.docs/phases/PHASE1_SUMMARY.md` - Phase overview
- **Phase 1 Todo:** `.docs/phases/PHASE1_TODO.md` - Task breakdown
- **API Documentation:** `.docs/02-api-and-data-model.md` - Full API spec
- **Project Context:** `AGENTS.md` - High-level project overview

---

## 16. Questions?

- Check `.docs/SESSION_SUMMARY.md` for recent work
- Review `.docs/05-quick-reference.md` for quick answers
- Consult `.docs/02-api-and-data-model.md` for API details

---

**You're all set! 🚀**

Start with **dev-7 (Frontend Auth Client)** to integrate frontend with the working backend API.
