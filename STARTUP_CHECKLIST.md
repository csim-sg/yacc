# YACC Phase 1 Startup Checklist

> **Version**: 0.1.0  
> **Purpose**: Complete guide to get YACC backend running  
> **Estimated Time**: 15-20 minutes for first-time setup

---

## Table of Contents

1. [Pre-Flight Checks](#pre-flight-checks)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Installation & Build](#installation--build)
5. [First-Run Verification](#first-run-verification)
6. [Troubleshooting](#troubleshooting)
7. [Next Steps](#next-steps)

---

## Pre-Flight Checks

### System Requirements

- [ ] **Node.js**: v18.0.0 or higher
  ```bash
  node --version
  # Expected: v18.x.x or higher
  ```

- [ ] **npm**: v9.0.0 or higher (or pnpm v8.0.0+)
  ```bash
  npm --version
  # Expected: v9.x.x or higher
  ```

- [ ] **PostgreSQL**: v14.0 or higher
  ```bash
  psql --version
  # Expected: psql (PostgreSQL) 14.x or higher
  ```

- [ ] **Redis**: v6.0 or higher (optional for Phase 1, required for Phase 2)
  ```bash
  redis-cli --version
  # Expected: redis-cli x.x.x
  ```

- [ ] **Git**: v2.30.0 or higher
  ```bash
  git --version
  # Expected: git version 2.x.x
  ```

### Verify Software Installation

```bash
# Check all versions
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "PostgreSQL: $(psql --version)"
echo "Redis: $(redis-cli --version)"
echo "Git: $(git --version)"
```

**Expected Output**:
```
Node: v18.x.x
npm: v9.x.x
PostgreSQL: psql (PostgreSQL) 14.x or higher
Redis: redis-cli x.x.x
Git: git version 2.x.x
```

### Required Ports

| Service | Port | Status | Used For |
|---------|------|--------|----------|
| Backend API | 3000 | ✅ Required | Main API server |
| Frontend | 5173 | ✅ Required | Vite dev server (Phase 2) |
| PostgreSQL | 5432 | ✅ Required | Database |
| Redis | 6379 | ⚠️ Optional | Phase 2+ |
| MailHog | 8025 | ⚠️ Dev only | Email testing |

**Check Port Availability**:

```bash
# Linux/Mac
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5432
```

---

## Environment Setup

### Step 1: Clone Repository

```bash
# Already done if you're reading this in the project

# Otherwise:
git clone https://github.com/your-org/yacc-client.git
cd yacc-client
```

### Step 2: Copy Environment Files

```bash
# Root .env file (if needed)
cp .env.example .env

# Backend .env file
cp packages/backend/.env.example packages/backend/.env
```

### Step 3: Update Backend .env

Edit `packages/backend/.env`:

```bash
nano packages/backend/.env
# or
code packages/backend/.env
```

**Minimum Required Variables** (Phase 1):

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# PostgreSQL
DATABASE_URL=postgresql://yacc_user:yacc_password@localhost:5432/yacc_inbox

# Redis (optional for Phase 1, required for Phase 2)
REDIS_URL=redis://localhost:6379

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-key-change-this

# Email (development)
SMTP_FROM_EMAIL=noreply@yacc.local
EMAIL_PROVIDER=nodemailer
```

**For Development with MailHog**:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
```

### Step 4: Verify .env is Not Tracked by Git

```bash
# Check .gitignore
grep "\.env" .gitignore
# Should output: .env, .env.local, etc.

# Verify .env not staged
git status packages/backend/.env
# Should show: nothing to commit
```

---

## Database Setup

### Step 1: Start PostgreSQL

**Option A: Docker** (Recommended for development)

```bash
# Create and run PostgreSQL container
docker run -d \
  --name yacc-postgres \
  -e POSTGRES_USER=yacc_user \
  -e POSTGRES_PASSWORD=yacc_password \
  -e POSTGRES_DB=yacc_inbox \
  -p 5432:5432 \
  postgres:14-alpine

# Verify container is running
docker ps | grep yacc-postgres
```

**Option B: Local PostgreSQL Installation**

```bash
# Mac (Homebrew)
brew services start postgresql

# Ubuntu/Debian
sudo systemctl start postgresql

# Windows
# Start PostgreSQL from Services app or:
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start
```

### Step 2: Create Database and User

```bash
# Connect to PostgreSQL
psql -U postgres

# Then run these commands:
CREATE USER yacc_user WITH PASSWORD 'yacc_password';
CREATE DATABASE yacc_inbox OWNER yacc_user;
GRANT ALL PRIVILEGES ON DATABASE yacc_inbox TO yacc_user;
\q
```

**Or in one command**:

```bash
psql -U postgres -c "CREATE USER yacc_user WITH PASSWORD 'yacc_password';" && \
psql -U postgres -c "CREATE DATABASE yacc_inbox OWNER yacc_user;" && \
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE yacc_inbox TO yacc_user;"
```

### Step 3: Verify Database Connection

```bash
# Connect to the database
psql -h localhost -U yacc_user -d yacc_inbox

# You should see: yacc_inbox=>
# Type \q to exit
```

**Or with connection string**:

```bash
psql postgresql://yacc_user:yacc_password@localhost:5432/yacc_inbox

# Should work without errors
\q
```

### Step 4: Check Database is Empty

```bash
# List tables (should be empty for first run)
psql -h localhost -U yacc_user -d yacc_inbox -c "\dt"

# Expected output: "Did not find any relations"
```

---

## Installation & Build

### Step 1: Install Dependencies

```bash
# From project root
cd /path/to/yacc-client

# Install monorepo dependencies
pnpm install

# Or with npm
npm install
```

**Expected Output**:
```
pnpm install (or npm install)
...
packages installed
```

### Step 2: Build Backend

```bash
# Change to backend directory
cd packages/backend

# Build TypeScript
pnpm run build

# Or npm
npm run build
```

**Expected Output**:
```
npm run build
> backend@0.1.0 build
> tsc

Successfully compiled.
```

### Step 3: Run Database Migrations

```bash
# From backend directory
pnpm run migrate

# Or: npm run migrate
```

**Expected Output**:
```
npm run migrate
> backend@0.1.0 migrate
> tsx src/infrastructure/db/migrations.ts

✅ Running migrations...
✅ Migration complete
✅ Tables created: users, conversations, messages, tags, notes, ...
```

**Verify Tables Created**:

```bash
psql -h localhost -U yacc_user -d yacc_inbox -c "\dt"

# Should list:
# - users
# - conversations
# - messages
# - tags
# - conversation_tags
# - notes
# - audit_logs
# - password_reset_tokens
# - and more...
```

---

## First-Run Verification

### Step 1: Start Backend Server

```bash
# From backend directory (packages/backend)
pnpm run dev

# Or: npm run dev
```

**Expected Output**:
```
npm run dev
> backend@0.1.0 dev
> node --loader ts-node/esm src/index.ts

✅ Connected to database
✅ Running migrations...
🚀 Server running on port 3000
📍 API: http://localhost:3000/api
🔗 WebSocket: ws://localhost:3000
```

**Note**: Server will keep running. Keep this terminal open or use `&` to background it.

### Step 2: Verify API is Responding

Open another terminal:

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2026-01-17T12:00:00Z"}
```

### Step 3: Test API Index

```bash
curl http://localhost:3000/api

# Expected response:
# {
#   "message": "YACC Inbox API",
#   "version": "0.1.0",
#   "endpoints": {
#     "health": "/health",
#     "auth": "/api/auth",
#     "conversations": "/api/conversations",
#     "audit-logs": "/api/audit-logs"
#   }
# }
```

### Step 4: Register Test User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User"
  }'

# Expected response:
# {
#   "success": true,
#   "user": {
#     "id": 1,
#     "email": "test@example.com",
#     "name": "Test User",
#     "role": "user",
#     "status": "active",
#     "createdAt": "2026-01-17T12:05:00Z"
#   },
#   "message": "User registered successfully"
# }
```

### Step 5: Login Test User

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'

# Expected response:
# {
#   "success": true,
#   "user": { ... },
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": "7d"
# }

# Save the token for next test
export TEST_TOKEN="your_token_here"
```

### Step 6: Test Authenticated Endpoint

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TEST_TOKEN"

# Expected response:
# {
#   "success": true,
#   "user": {
#     "id": 1,
#     "email": "test@example.com",
#     "name": "Test User",
#     ...
#   }
# }
```

### Step 7: Verify Database Updated

```bash
# Check users table
psql -h localhost -U yacc_user -d yacc_inbox -c "SELECT id, email, name, role FROM users;"

# Expected output:
# id | email             | name       | role
# 1  | test@example.com  | Test User  | user
```

---

## Optional: Setup Development Tools

### MailHog (Email Testing)

```bash
# Start MailHog with Docker
docker run -d \
  --name mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog

# Access mail UI: http://localhost:8025

# Update .env:
# SMTP_HOST=localhost
# SMTP_PORT=1025
```

### Redis (for Phase 2)

```bash
# Start Redis with Docker
docker run -d \
  --name yacc-redis \
  -p 6379:6379 \
  redis:alpine

# Verify connection
redis-cli ping
# Expected: PONG
```

### Setup Script

Create `scripts/setup.sh` for automated setup:

```bash
#!/bin/bash
set -e

echo "🚀 YACC Backend Setup Script"

# Check Node.js
echo "✅ Checking Node.js..."
node --version

# Install dependencies
echo "✅ Installing dependencies..."
pnpm install

# Copy env files
echo "✅ Setting up environment..."
cp .env.example .env 2>/dev/null || true
cp packages/backend/.env.example packages/backend/.env 2>/dev/null || true

# Build backend
echo "✅ Building backend..."
cd packages/backend
pnpm run build

# Run migrations
echo "✅ Running migrations..."
pnpm run migrate

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update packages/backend/.env with your configuration"
echo "2. Start the server: pnpm run dev"
echo "3. Test: curl http://localhost:3000/health"
```

---

## Troubleshooting

### Issue: "PostgreSQL connection refused"

**Symptoms**: Cannot connect to database

**Solution**:

```bash
# 1. Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# 2. Verify connection string in .env
# Format: postgresql://user:password@host:port/database
echo $DATABASE_URL

# 3. Test connection
psql "$DATABASE_URL" -c "SELECT NOW()"

# 4. Check if port 5432 is listening
lsof -i :5432

# 5. If using Docker, ensure container is running
docker ps | grep postgres
```

### Issue: "Port 3000 already in use"

**Solution**:

```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm run dev
```

### Issue: "Missing migration files"

**Solution**:

```bash
# Ensure migrations directory exists
ls packages/backend/src/infrastructure/db/migrations.ts

# Check database schema manually
psql -h localhost -U yacc_user -d yacc_inbox -c "\dt"

# If tables don't exist, run manually
cd packages/backend
npm run migrate
```

### Issue: "Authentication token invalid"

**Solution**:

```bash
# Ensure JWT_SECRET is set
echo $JWT_SECRET

# Generate new secret
openssl rand -base64 32

# Update .env and restart server
# Token valid for 7 days, generate new one if expired
```

### Issue: "Zod validation errors"

**Solution**:

```bash
# Check request body format
# Ensure all required fields are present
# Example: email must be valid format

# Review validation schemas in:
# packages/backend/src/api/routes/*.ts
```

### Issue: "Permission denied" errors

**Solution**:

```bash
# Fix directory permissions
chmod -R 755 packages/backend

# Or fix node_modules
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: "Cannot find module '@yacc/common'"

**Solution**:

```bash
# Ensure workspace packages are installed
pnpm install -w

# Verify symlinks
ls -la node_modules/@yacc/

# Rebuild if needed
pnpm run build -r
```

### Issue: "CORS error when connecting from frontend"

**Solution**:

```bash
# Update FRONTEND_URL in backend .env
FRONTEND_URL=http://localhost:5173

# Verify CORS is enabled in index.ts
# Restart backend server
pnpm run dev
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* pnpm run dev

# Or enable Drizzle logging
DRIZZLE_DEBUG=true pnpm run dev

# Check database queries
psql -h localhost -U yacc_user -d yacc_inbox
# \x on  (enable expanded display)
# SELECT * FROM users;
```

---

## Docker Compose (Optional)

Use Docker Compose for complete setup:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: yacc_user
      POSTGRES_PASSWORD: yacc_password
      POSTGRES_DB: yacc_inbox
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
```

**Usage**:

```bash
# Start all services
docker-compose up -d

# Check services
docker-compose ps

# View logs
docker-compose logs -f postgres

# Stop all services
docker-compose down
```

---

## Next Steps

### After Successful Startup

1. **Read API Documentation**
   ```bash
   cat API_DOCUMENTATION.md
   ```

2. **Run Test Suite**
   ```bash
   cd packages/backend
   pnpm run test
   ```

3. **Use Testing Guide**
   ```bash
   cat TESTING_GUIDE.md
   ```

4. **Import Postman Collection**
   - Use collection from TESTING_GUIDE.md
   - Set up environment variables

5. **Setup Frontend** (Phase 2)
   ```bash
   cd packages/frontend
   pnpm install
   pnpm run dev
   ```

### Common Development Tasks

```bash
# Watch TypeScript files
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Type check
npm run type-check

# Format code
npm run format

# Database reset (WARNING: deletes all data)
npm run db:reset
```

### Performance Tuning

```bash
# Enable query logging
DRIZZLE_DEBUG=true npm run dev

# Monitor database
psql -h localhost -U yacc_user -d yacc_inbox
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;

# Monitor Redis (if Phase 2)
redis-cli MONITOR
```

---

## Security Checklist

Before Production Deployment:

- [ ] Change JWT_SECRET to a secure random value
- [ ] Change all default passwords
- [ ] Enable HTTPS for FRONTEND_URL
- [ ] Configure proper database backups
- [ ] Enable database encryption at rest
- [ ] Set up error monitoring (Sentry)
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Set up log aggregation
- [ ] Enable audit logging (already done in Phase 1)
- [ ] Review and update CORS settings
- [ ] Set NODE_ENV=production
- [ ] Enable HTTP security headers
- [ ] Configure CDN for static files

---

## Support & Resources

| Resource | Link |
|----------|------|
| API Documentation | `API_DOCUMENTATION.md` |
| Testing Guide | `TESTING_GUIDE.md` |
| Environment Variables | `packages/backend/.env.example` |
| Database Schema | `packages/backend/src/infrastructure/db/schema.ts` |
| Architecture | `ARCHITECTURE_AND_IMPLEMENTATION.md` |
| Product Spec | `.docs/01-product-specification.md` |

---

**🎉 Congratulations!** Your YACC backend is now running.

**Next**: Set up frontend (Phase 2) or start implementing additional endpoints.

For questions, see `API_DOCUMENTATION.md` or review `packages/backend/README.md`.
