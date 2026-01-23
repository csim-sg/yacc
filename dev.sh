#!/bin/bash

# YACC Phase 1 Backend - Development Server Script
# Purpose: Start Docker services and run backend in development mode
# Usage: ./dev.sh

set -e

# ============================================================================
# Configuration
# ============================================================================

COMPOSE_CMD="docker-compose"
BACKEND_DIR="packages/backend"
PORT="${PORT:-3000}"
NODE_ENV="${NODE_ENV:-development}"

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

print_section() {
    echo -e "\n${CYAN}→ $1${NC}"
}

# ============================================================================
# Check Prerequisites
# ============================================================================

check_prerequisites() {
    print_section "Checking prerequisites..."
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        print_error ".env file not found"
        print_info "Run: ./setup.sh first"
        exit 1
    fi
    
    # Check if backend directory exists
    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    print_success "Prerequisites verified"
}

# ============================================================================
# Docker Services Management
# ============================================================================

check_docker_available() {
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not available - assuming services are running"
        return 1
    fi
    
    # Check for docker-compose or docker compose
    if ! command -v docker-compose &> /dev/null; then
        if docker compose version &> /dev/null; then
            COMPOSE_CMD="docker compose"
            return 0
        else
            print_warning "docker-compose not available"
            return 1
        fi
    fi
    
    return 0
}

is_service_running() {
    local service=$1
    if docker ps --filter "name=${service}" --format "{{.Names}}" | grep -q "${service}"; then
        return 0
    fi
    return 1
}

wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    print_info "Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if timeout 2 bash -c "</dev/tcp/127.0.0.1/$port" 2>/dev/null; then
            print_success "$service is ready"
            return 0
        fi
        
        echo -ne "${CYAN}  Attempt $attempt/$max_attempts\r${NC}"
        sleep 1
        ((attempt++))
    done
    
    print_warning "$service did not start in time (may already be running)"
    return 1
}

start_docker_services() {
    print_section "Starting Docker services..."
    
    if ! check_docker_available; then
        print_warning "Docker not available - skipping service startup"
        return 1
    fi
    
    # Check if services are already running
    if is_service_running "postgres" && is_service_running "redis"; then
        print_success "Docker services already running"
        return 0
    fi
    
    # Start services
    print_info "Starting services with: $COMPOSE_CMD up -d"
    
    if $COMPOSE_CMD up -d postgres redis mailhog 2>&1; then
        print_success "Docker services started"
        
        # Wait for services
        wait_for_service "postgres" 5432 || true
        wait_for_service "redis" 6379 || true
        
        return 0
    else
        print_error "Failed to start Docker services"
        return 1
    fi
}

show_docker_status() {
    if ! check_docker_available; then
        return
    fi
    
    print_section "Docker services status:"
    $COMPOSE_CMD ps
}

# ============================================================================
# Backend Development Server
# ============================================================================

start_dev_server() {
    print_section "Starting backend development server..."
    
    cd "$BACKEND_DIR"
    
    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found in backend - installing..."
        pnpm install
    fi
    
    # Check if TypeScript is built
    if [ ! -d "dist" ]; then
        print_info "Building TypeScript..."
        pnpm build
    fi
    
    print_info "Starting dev server on port $PORT..."
    print_info "Press Ctrl+C to stop\n"
    
    # Start dev server with environment variables
    export NODE_ENV="$NODE_ENV"
    export PORT="$PORT"
    
    # Use ts-node for development (faster than build + run)
    pnpm dev
}

# ============================================================================
# Graceful Shutdown
# ============================================================================

cleanup() {
    print_header "Shutting down..."
    
    print_section "Stopping backend server..."
    
    # Kill the dev server (it will receive SIGINT)
    kill $DEV_PID 2>/dev/null || true
    
    print_info "Waiting for server to stop..."
    sleep 2
    
    # Optionally stop Docker services
    if [ "$STOP_DOCKER" = "true" ]; then
        print_section "Stopping Docker services..."
        if check_docker_available; then
            $COMPOSE_CMD down
            print_success "Docker services stopped"
        fi
    fi
    
    print_success "Shutdown complete"
    exit 0
}

# ============================================================================
# Main Script
# ============================================================================

main() {
    print_header "YACC Phase 1 Backend - Development Server"
    
    # Check prerequisites
    check_prerequisites
    
    # Check for --help flag
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        print_header "Usage"
        echo "  ./dev.sh [OPTIONS]"
        echo ""
        echo "OPTIONS:"
        echo "  --help, -h           Show this help message"
        echo "  --skip-docker        Don't start/check Docker services"
        echo "  --stop-on-exit       Stop Docker services when server exits"
        echo "  --port PORT          Run on different port (default: 3000)"
        echo ""
        echo "ENVIRONMENT VARIABLES:"
        echo "  PORT                 Server port (default: 3000)"
        echo "  NODE_ENV             Node environment (default: development)"
        echo "  API_URL              API base URL (default: http://localhost:3000)"
        echo ""
        exit 0
    fi
    
    # Parse flags
    SKIP_DOCKER=false
    STOP_DOCKER=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            --stop-on-exit)
                STOP_DOCKER=true
                shift
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Setup signal handlers
    trap cleanup SIGINT SIGTERM EXIT
    
    # Start Docker services (unless skipped)
    if [ "$SKIP_DOCKER" = "false" ]; then
        start_docker_services || true
        show_docker_status
    fi
    
    # Display startup info
    echo ""
    print_info "Configuration:"
    echo "  NODE_ENV: $NODE_ENV"
    echo "  PORT: $PORT"
    echo "  Backend Dir: $BACKEND_DIR"
    echo ""
    
    # Show how to test
    print_info "Test the API:"
    echo "  • Health check: curl http://localhost:$PORT/health"
    echo "  • API root: curl http://localhost:$PORT/api"
    echo "  • Run tests: ./test-api.sh"
    echo ""
    
    # Start development server
    start_dev_server &
    DEV_PID=$!
    
    # Wait for dev server
    wait $DEV_PID
}

# ============================================================================
# Run
# ============================================================================

main "$@"
