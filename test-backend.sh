#!/bin/bash
# YACC Backend Verification Script
# Usage: ./test-backend.sh

set -e

echo "🧪 YACC Backend Verification"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Check Docker services
echo "1️⃣  Checking Docker services..."
if docker compose ps | grep -q "Up (healthy).*postgres"; then
    echo -e "${GREEN}✓${NC} Postgres is running"
else
    echo -e "${RED}✗${NC} Postgres is not running"
    exit 1
fi

if docker compose ps | grep -q "Up.*redis"; then
    echo -e "${GREEN}✓${NC} Redis is running"
else
    echo -e "${RED}✗${NC} Redis is not running"
    exit 1
fi

echo ""

# 2. Check database tables
echo "2️⃣  Checking database schema..."
TABLE_COUNT=$(docker exec yacc-client-postgres-1 psql -U yacc_user -d yacc_inbox -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

if [ "$TABLE_COUNT" -eq 15 ]; then
    echo -e "${GREEN}✓${NC} All 15 tables exist"
else
    echo -e "${RED}✗${NC} Expected 15 tables, found $TABLE_COUNT"
    exit 1
fi

echo ""

# 3. Check admin user
echo "3️⃣  Checking admin user..."
ADMIN_COUNT=$(docker exec yacc-client-postgres-1 psql -U yacc_user -d yacc_inbox -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@yacc.local' AND role = 'super_admin';" | tr -d ' ')

if [ "$ADMIN_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✓${NC} Admin user exists"
else
    echo -e "${RED}✗${NC} Admin user not found"
    exit 1
fi

echo ""

# 4. Check backend health
echo "4️⃣  Checking backend API..."
if curl -s http://localhost:3000/health | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓${NC} Backend is responding"
else
    echo -e "${RED}✗${NC} Backend health check failed"
    echo "   Make sure backend is running: cd packages/backend && npm run dev"
    exit 1
fi

echo ""

# 5. Test auth endpoint
echo "5️⃣  Testing authentication..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yacc.local", "password": "admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"email":"admin@yacc.local"'; then
    echo -e "${GREEN}✓${NC} Login successful"
    
    # Extract token from response header
    TOKEN=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email \
      -H "Content-Type: application/json" \
      -d '{"email": "admin@yacc.local", "password": "admin123"}' | grep -i "set-auth-token" | cut -d: -f2 | tr -d ' \r')
    
    if [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✓${NC} Access token received"
    fi
else
    echo -e "${RED}✗${NC} Login failed"
    echo "   Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""

# 6. Test protected endpoint
echo "6️⃣  Testing protected endpoint..."
CONVERSATIONS_RESPONSE=$(curl -s http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $TOKEN")

if echo "$CONVERSATIONS_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓${NC} Protected endpoint accessible with token"
else
    echo -e "${RED}✗${NC} Protected endpoint failed"
    echo "   Response: $CONVERSATIONS_RESPONSE"
    exit 1
fi

echo ""
echo "=============================="
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Backend is ready for development."
echo ""
echo "Next steps:"
echo "  • Start frontend: cd packages/frontend && npm run dev"
echo "  • Implement dev-7: Frontend auth client integration"
echo "  • See .docs/GETTING_STARTED.md for details"
echo ""
