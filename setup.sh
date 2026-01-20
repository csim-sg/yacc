#!/bin/bash

# YACC Phase 1 Backend - Automated Setup Script
# Purpose: Verify environment, install dependencies, setup database, and seed initial data
# Usage: ./setup.sh

set -e

# ============================================================================
# Color Codes
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

get_version() {
    echo "$($1 --version 2>&1 | head -1)"
}

# ============================================================================
# Main Setup Script
# ============================================================================

print_header "YACC Phase 1 Backend - Setup Script"

SETUP_FAILED=0

# ============================================================================
# Step 1: Verify Prerequisites
# ============================================================================

print_header "Step 1: Verifying Prerequisites"

# Check Node.js
if check_command "node"; then
    NODE_VERSION=$(get_version "node")
    print_info "Node.js version: $NODE_VERSION"
    
    # Verify Node.js 18+
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_error "Node.js 18+ is required (found v$NODE_MAJOR)"
        SETUP_FAILED=1
    fi
else
    print_error "Node.js is required but not installed"
    print_info "Download from: https://nodejs.org/ (v18+)"
    SETUP_FAILED=1
fi

# Check pnpm
if check_command "pnpm"; then
    PNPM_VERSION=$(get_version "pnpm")
    print_info "pnpm version: $PNPM_VERSION"
else
    print_error "pnpm is required but not installed"
    print_info "Install with: npm install -g pnpm@9.0.0"
    SETUP_FAILED=1
fi

# Check Docker
if check_command "docker"; then
    DOCKER_VERSION=$(get_version "docker")
    print_info "Docker version: $DOCKER_VERSION"
else
    print_warning "Docker is not installed - you may need to start services manually"
    print_info "Install from: https://docs.docker.com/get-docker/"
fi

# Check docker-compose
if check_command "docker-compose"; then
    COMPOSE_VERSION=$(get_version "docker-compose")
    print_info "docker-compose version: $COMPOSE_VERSION"
else
    print_warning "docker-compose not found - checking for 'docker compose' command"
    if docker compose version &> /dev/null; then
        print_success "docker compose (v2) is available"
    fi
fi

if [ $SETUP_FAILED -eq 1 ]; then
    print_error "Prerequisites check failed"
    exit 1
fi

# ============================================================================
# Step 2: Setup Environment Variables
# ============================================================================

print_header "Step 2: Setting Up Environment Variables"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        print_success "Created $ENV_FILE from $ENV_EXAMPLE"
        print_warning "⚠️  Please update $ENV_FILE with your actual credentials:"
        print_info "  - JWT_SECRET: Change to a secure random string"
        print_info "  - TELEGRAM_BOT_TOKEN: Add your Telegram bot token"
        print_info "  - AWS credentials: Add S3 access keys (optional for Phase 1)"
    else
        print_error "$ENV_EXAMPLE not found - cannot create $ENV_FILE"
        SETUP_FAILED=1
    fi
else
    print_success "$ENV_FILE already exists"
fi

# ============================================================================
# Step 3: Install Dependencies
# ============================================================================

print_header "Step 3: Installing Dependencies"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    print_info "node_modules directory exists - skipping root install"
else
    print_info "Installing root dependencies..."
    pnpm install --frozen-lockfile || {
        print_error "Failed to install root dependencies"
        SETUP_FAILED=1
    }
fi

# Install backend dependencies
print_info "Installing backend dependencies..."
cd packages/backend
pnpm install --frozen-lockfile || {
    print_error "Failed to install backend dependencies"
    SETUP_FAILED=1
}
cd - > /dev/null

print_success "All dependencies installed"

# ============================================================================
# Step 4: Check Docker Services
# ============================================================================

print_header "Step 4: Checking Docker Services"

check_postgres() {
    if docker ps --filter "name=yacc-client-postgres" --format "{{.Names}}" | grep -q "yacc-client-postgres"; then
        return 0
    elif docker ps -a --filter "name=yacc-client-postgres" --format "{{.Names}}" | grep -q "yacc-client-postgres"; then
        return 1
    fi
    return 1
}

check_redis() {
    if docker ps --filter "name=yacc-client-redis" --format "{{.Names}}" | grep -q "yacc-client-redis"; then
        return 0
    elif docker ps -a --filter "name=yacc-client-redis" --format "{{.Names}}" | grep -q "yacc-client-redis"; then
        return 1
    fi
    return 1
}

# Check Docker availability
if command -v docker &> /dev/null; then
    print_info "Docker is available, checking services..."
    
    # Compose file check
    COMPOSE_CMD="docker-compose"
    if ! command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker compose"
    fi
    
    # Check PostgreSQL
    if check_postgres; then
        print_success "PostgreSQL container is running"
    elif check_postgres; then
        print_warning "PostgreSQL container exists but is not running"
        print_info "Start with: $COMPOSE_CMD up -d postgres"
    else
        print_warning "PostgreSQL container not found"
        print_info "Start services with: $COMPOSE_CMD up -d"
    fi
    
    # Check Redis
    if check_redis; then
        print_success "Redis container is running"
    elif check_redis; then
        print_warning "Redis container exists but is not running"
        print_info "Start with: $COMPOSE_CMD up -d redis"
    else
        print_warning "Redis container not found"
        print_info "Start services with: $COMPOSE_CMD up -d"
    fi
else
    print_warning "Docker not available - you will need to start PostgreSQL and Redis manually"
fi

# ============================================================================
# Step 5: Build Backend
# ============================================================================

print_header "Step 5: Building Backend"

cd packages/backend
print_info "Running type-check..."
pnpm type-check || {
    print_error "Type-check failed"
    SETUP_FAILED=1
}

print_info "Building TypeScript..."
pnpm build || {
    print_error "Build failed"
    SETUP_FAILED=1
}
cd - > /dev/null

print_success "Backend built successfully"

# ============================================================================
# Final Summary
# ============================================================================

print_header "Setup Complete!"

if [ $SETUP_FAILED -eq 0 ]; then
    print_success "All checks passed!"
    echo ""
    print_info "Next steps:"
    echo "  1. Verify .env configuration (credentials)"
    echo "  2. Start Docker services: docker-compose up -d"
    echo "  3. Run database migrations: ./setup.sh (will be automated)"
    echo "  4. Start dev server: ./dev.sh"
    echo "  5. Test API: ./test-api.sh"
    echo ""
    print_info "Useful commands:"
    echo "  • View logs: docker-compose logs -f"
    echo "  • Stop services: docker-compose down"
    echo "  • Start dev: ./dev.sh"
    echo "  • Run tests: pnpm test"
    echo ""
else
    print_error "Setup encountered errors - please fix issues above and run again"
    exit 1
fi
