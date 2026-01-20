#!/bin/bash

# YACC Phase 1 Backend - API Verification Script
# Purpose: Test core API endpoints and functionality
# Usage: ./test-api.sh

set -e

# ============================================================================
# Configuration
# ============================================================================

API_URL="${API_URL:-http://localhost:3000}"
MAX_RETRIES=30
RETRY_DELAY=1
TIMEOUT=10
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Color Codes
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
    echo -e "${CYAN}→ Testing: $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# ============================================================================
# Check Server Availability
# ============================================================================

wait_for_server() {
    print_header "Waiting for Server to Be Ready"
    
    local count=0
    while [ $count -lt $MAX_RETRIES ]; do
        print_info "Attempt $((count + 1))/$MAX_RETRIES - checking $API_URL..."
        
        if curl -s -m $TIMEOUT "$API_URL/health" > /dev/null 2>&1; then
            print_pass "Server is ready"
            return 0
        fi
        
        sleep $RETRY_DELAY
        ((count++))
    done
    
    print_fail "Server did not respond after $MAX_RETRIES attempts"
    print_info "Make sure the backend is running: ./dev.sh"
    exit 1
}

# ============================================================================
# API Test Functions
# ============================================================================

test_health_endpoint() {
    print_test "Health Endpoint"
    
    response=$(curl -s -w "\n%{http_code}" -m $TIMEOUT "$API_URL/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_pass "Health endpoint returned 200"
        echo "  Response: $body"
    else
        print_fail "Health endpoint returned $http_code"
        echo "  Response: $body"
    fi
}

test_api_root() {
    print_test "API Root Endpoint"
    
    response=$(curl -s -w "\n%{http_code}" -m $TIMEOUT "$API_URL/api")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_pass "API root endpoint returned 200"
        echo "  Response: $body"
    else
        print_fail "API root endpoint returned $http_code"
        echo "  Response: $body"
    fi
}

test_auth_endpoints() {
    print_header "Testing Authentication Endpoints"
    
    # Test register endpoint
    print_test "User Registration"
    
    # Generate unique email
    timestamp=$(date +%s%N)
    test_email="testuser_${timestamp}@test.local"
    test_password="TestPassword123!"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$test_email\",
            \"password\": \"$test_password\",
            \"name\": \"Test User\"
        }" \
        -m $TIMEOUT)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        print_pass "User registration endpoint responded with $http_code"
        echo "  Response: $body"
        
        # Extract user token for next tests
        USER_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")
        USER_EMAIL="$test_email"
    else
        print_fail "User registration returned $http_code"
        echo "  Response: $body"
        return
    fi
    
    # Test login endpoint
    print_test "User Login"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$test_email\",
            \"password\": \"$test_password\"
        }" \
        -m $TIMEOUT)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_pass "Login endpoint returned $http_code"
        echo "  Response: $body"
        
        # Extract token from response
        USER_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")
        if [ -z "$USER_TOKEN" ]; then
            # Try alternative response format
            USER_TOKEN=$(echo "$body" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
        fi
    else
        print_fail "Login returned $http_code"
        echo "  Response: $body"
    fi
}

test_conversations_endpoints() {
    print_header "Testing Conversation Endpoints"
    
    # Test: Get conversations (should be empty initially)
    print_test "Get Conversations List (no auth)"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "$API_URL/api/conversations" \
        -m $TIMEOUT)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Should either return 200 (empty list) or 401 (requires auth)
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
        print_pass "Get conversations returned $http_code"
        echo "  Response: $body"
    else
        print_fail "Get conversations returned $http_code"
        echo "  Response: $body"
    fi
}

test_audit_endpoints() {
    print_header "Testing Audit Log Endpoints"
    
    # Test: Get audit logs
    print_test "Get Audit Logs"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "$API_URL/api/audit-logs" \
        -m $TIMEOUT)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Should either return 200 or 401 (requires auth)
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
        print_pass "Get audit logs returned $http_code"
        echo "  Response: $body"
    else
        print_fail "Get audit logs returned $http_code"
        echo "  Response: $body"
    fi
}

# ============================================================================
# Database Connectivity
# ============================================================================

test_database_health() {
    print_header "Checking Database Connectivity"
    
    print_test "PostgreSQL Connection"
    
    # Check if database environment variables are set
    db_url="${DATABASE_URL:-postgresql://yacc_user:yacc_password@localhost:5432/yacc_inbox}"
    
    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL not set in environment, using default"
        print_info "Database URL: $db_url (masked)"
    fi
    
    # Try to connect using psql (if available)
    if command -v psql &> /dev/null; then
        if psql "$db_url" -c "SELECT version();" > /dev/null 2>&1; then
            print_pass "PostgreSQL connection successful"
        else
            print_warning "Could not connect to PostgreSQL via psql"
            print_info "This may be OK if running inside Docker"
        fi
    else
        print_warning "psql not available - skipping direct database test"
        print_info "Database connectivity will be validated when server starts"
    fi
}

# ============================================================================
# Performance Tests
# ============================================================================

test_response_times() {
    print_header "Testing Response Times"
    
    print_test "Health Endpoint Response Time"
    
    # Measure response time
    start_time=$(date +%s%N)
    
    response=$(curl -s -w "\n%{http_code}" \
        -m $TIMEOUT "$API_URL/health")
    
    end_time=$(date +%s%N)
    elapsed_ms=$(( (end_time - start_time) / 1000000 ))
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ $elapsed_ms -lt 1000 ]; then
        print_pass "Health check responded in ${elapsed_ms}ms"
    elif [ $elapsed_ms -lt 5000 ]; then
        print_warning "Health check took ${elapsed_ms}ms (a bit slow)"
    else
        print_fail "Health check took ${elapsed_ms}ms (too slow)"
    fi
}

# ============================================================================
# Main Test Suite
# ============================================================================

main() {
    print_header "YACC Phase 1 Backend - API Verification"
    
    print_info "Target API: $API_URL"
    echo ""
    
    # Wait for server
    wait_for_server
    
    # Basic health checks
    echo ""
    print_header "Basic Connectivity Tests"
    test_health_endpoint
    test_api_root
    
    # Response times
    echo ""
    test_response_times
    
    # Auth tests
    echo ""
    test_auth_endpoints
    
    # Conversation tests
    echo ""
    test_conversations_endpoints
    
    # Audit tests
    echo ""
    test_audit_endpoints
    
    # Database health
    echo ""
    test_database_health
    
    # Final Summary
    print_header "Test Summary"
    
    total_tests=$((TESTS_PASSED + TESTS_FAILED))
    pass_rate=0
    if [ $total_tests -gt 0 ]; then
        pass_rate=$(( (TESTS_PASSED * 100) / total_tests ))
    fi
    
    echo -e "${CYAN}Total Tests: $total_tests${NC}"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo -e "${CYAN}Pass Rate: ${pass_rate}%${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_pass "All critical tests passed!"
        echo ""
        print_info "The backend is ready for integration testing."
        echo ""
        exit 0
    else
        print_warning "Some tests failed - review errors above"
        echo ""
        print_info "Common issues:"
        echo "  • Backend server not running: use ./dev.sh"
        echo "  • Wrong API_URL: export API_URL=http://localhost:3000"
        echo "  • Database not connected: check docker-compose and logs"
        echo "  • Port already in use: change PORT in .env"
        echo ""
        exit 1
    fi
}

# ============================================================================
# Run Tests
# ============================================================================

main "$@"
