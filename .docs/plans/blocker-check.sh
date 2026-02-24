#!/bin/bash

# DEV-002-006 Blocker Monitoring Script
# Usage: ./blocker-check.sh
# Provides real-time status of blocker resolution

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}DEV-002-006 BLOCKER MONITORING DASHBOARD${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Generated: $(date)"
echo ""

# ============================================================================
# BLOCKER 1: LINT ERRORS
# ============================================================================

echo -e "${YELLOW}🔴 BLOCKER #1: LINT ERRORS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

lint_output=$(pnpm --filter @yacc/backend lint 2>&1 || true)
lint_errors=$(echo "$lint_output" | grep -c "error" || echo "0")

if [ "$lint_errors" = "0" ]; then
    echo -e "${GREEN}✅ LINT PASSED (0 errors)${NC}"
else
    echo -e "${RED}❌ LINT FAILED ($lint_errors errors)${NC}"
    
    # Show specific errors mentioned in blocker tracking
    echo ""
    echo "Checking for tracked lint errors:"
    echo ""
    
    # Error 1.1: Unused import in irc.adapter.spec.ts
    if grep -q "InboundMessageEvent" packages/backend/src/infrastructure/__tests__/irc.adapter.spec.ts 2>/dev/null; then
        echo -e "  ${RED}❌${NC} Error 1.1: Unused import 'InboundMessageEvent' in irc.adapter.spec.ts"
    else
        echo -e "  ${GREEN}✅${NC} Error 1.1: Fixed (no unused import)"
    fi
    
    # Error 1.2: Multiple classes in gateway-exchange.spec.ts
    class_count=$(grep -c "^class " packages/backend/src/services/__tests__/gateway-exchange.spec.ts 2>/dev/null || echo "0")
    if [ "$class_count" -gt "1" ]; then
        echo -e "  ${RED}❌${NC} Error 1.2: Multiple classes ($class_count) in gateway-exchange.spec.ts"
    else
        echo -e "  ${GREEN}✅${NC} Error 1.2: Fixed (MockAdapter extracted)"
    fi
    
    # Error 1.3: Unused parameter in gateway-exchange.ts
    if grep -q "_correlationId\|unused.*correlationId" packages/backend/src/services/gateway-exchange.ts 2>/dev/null; then
        echo -e "  ${GREEN}✅${NC} Error 1.3: Fixed (parameter prefixed)"
    else
        echo -e "  ${RED}❌${NC} Error 1.3: Unused parameter in gateway-exchange.ts"
    fi
fi

echo ""

# ============================================================================
# BLOCKER 2: TEST FAILURES
# ============================================================================

echo -e "${YELLOW}🔴 BLOCKER #2: TEST FAILURES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run tests and capture results
test_output=$(pnpm --filter @yacc/backend test 2>&1 || true)
passed=$(echo "$test_output" | grep -oP '\d+(?= passed)' || echo "0")
failed=$(echo "$test_output" | grep -oP '\d+(?= failed)' || echo "0")

if [ "$failed" = "0" ] || [ "$failed" = "" ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo "   Passed: $passed/842 tests"
else
    echo -e "${RED}❌ TEST FAILURES DETECTED${NC}"
    echo "   Passed: $passed tests"
    echo "   Failed: $failed tests"
    echo ""
    echo "Test failure categories:"
    
    # Message API Tests
    if pnpm --filter @yacc/backend test -- tests/BE-009-010-message-api.spec.ts 2>&1 | grep -q "FAIL\|failed"; then
        echo -e "  ${RED}❌${NC} Message API Tests: FAILING"
    else
        echo -e "  ${GREEN}✅${NC} Message API Tests: PASSING"
    fi
    
    # Message Status Tracking
    if pnpm --filter @yacc/backend test -- tests/BE-011-message-status-tracking.spec.ts 2>&1 | grep -q "FAIL\|failed"; then
        echo -e "  ${RED}❌${NC} Message Status Tracking: FAILING"
    else
        echo -e "  ${GREEN}✅${NC} Message Status Tracking: PASSING"
    fi
    
    # Tags CRUD
    if pnpm --filter @yacc/backend test -- tests/BE-P2-001-tags-crud.spec.ts 2>&1 | grep -q "FAIL\|failed"; then
        echo -e "  ${RED}❌${NC} Tags CRUD: FAILING"
    else
        echo -e "  ${GREEN}✅${NC} Tags CRUD: PASSING"
    fi
    
    # Retry Worker
    if pnpm --filter @yacc/backend test -- src/workers/__tests__/messageRetryWorker.test.ts 2>&1 | grep -q "FAIL\|failed"; then
        echo -e "  ${RED}❌${NC} Retry Worker: FAILING"
    else
        echo -e "  ${GREEN}✅${NC} Retry Worker: PASSING"
    fi
fi

echo ""

# ============================================================================
# BLOCKER 3: COVERAGE VERIFICATION
# ============================================================================

echo -e "${YELLOW}🟡 BLOCKER #3: COVERAGE VERIFICATION${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$failed" != "0" ] && [ "$failed" != "" ]; then
    echo -e "${YELLOW}⏳ BLOCKED: Tests must pass first${NC}"
else
    echo "Running coverage analysis..."
    coverage_output=$(pnpm --filter @yacc/backend test -- --coverage 2>&1 || true)
    
    # Check coverage for key files
    echo "Coverage by file:"
    
    # gateway-exchange.ts
    if echo "$coverage_output" | grep -q "gateway-exchange.ts"; then
        gw_coverage=$(echo "$coverage_output" | grep "gateway-exchange.ts" | grep -oP '\d+\.\d+(?=%)')
        if [ -z "$gw_coverage" ]; then
            gw_coverage="0"
        fi
        if [ $(echo "$gw_coverage >= 85" | bc -l 2>/dev/null) = "1" ]; then
            echo -e "  ${GREEN}✅${NC} gateway-exchange.ts: $gw_coverage% (≥85%)"
        else
            echo -e "  ${RED}❌${NC} gateway-exchange.ts: $gw_coverage% (<85%)"
        fi
    else
        echo -e "  ${YELLOW}?${NC} gateway-exchange.ts: Not measured"
    fi
    
    # authentication.service.ts
    if echo "$coverage_output" | grep -q "authentication.service.ts"; then
        auth_coverage=$(echo "$coverage_output" | grep "authentication.service.ts" | grep -oP '\d+\.\d+(?=%)')
        if [ -z "$auth_coverage" ]; then
            auth_coverage="0"
        fi
        if [ $(echo "$auth_coverage >= 85" | bc -l 2>/dev/null) = "1" ]; then
            echo -e "  ${GREEN}✅${NC} authentication.service.ts: $auth_coverage% (≥85%)"
        else
            echo -e "  ${RED}❌${NC} authentication.service.ts: $auth_coverage% (<85%)"
        fi
    else
        echo -e "  ${YELLOW}?${NC} authentication.service.ts: Not measured"
    fi
fi

echo ""

# ============================================================================
# OVERALL STATUS
# ============================================================================

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}OVERALL STATUS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ "$lint_errors" = "0" ] && [ "$failed" = "0" ] || [ "$failed" = "" ]; then
    echo -e "${GREEN}✅ ALL BLOCKERS RESOLVED${NC}"
    echo ""
    echo "Next Step: Request final code review"
    echo "Command: Push changes and tag @code-reviewer in PR"
else
    echo -e "${RED}❌ BLOCKERS STILL PENDING${NC}"
    echo ""
    if [ "$lint_errors" != "0" ]; then
        echo "Lint errors remaining: $lint_errors"
    fi
    if [ "$failed" != "0" ] && [ "$failed" != "" ]; then
        echo "Test failures remaining: $failed"
    fi
fi

echo ""
echo "Last checked: $(date)"
echo ""
