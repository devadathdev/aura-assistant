#!/bin/bash

# AURA Assistant + FORGE + SENTINEL Unified Startup Script
# Runs all services simultaneously

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
AURA_PORT=3000
FORGE_API_PORT=4000
FORGE_WEB_PORT=3001
FORGE_WORKER_PORT=4002
SENTINEL_API_PORT=8000
SENTINEL_WEB_PORT=3002

# Process PIDs
PIDS=()

cleanup() {
    echo -e "\n${YELLOW}Shutting down all services...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    # Also kill any child processes
    pkill -P $$ 2>/dev/null || true
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=30
    local attempt=0
    
    echo -ne "${CYAN}Waiting for $name...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}Timeout!${NC}"
    return 1
}

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     AURA Assistant + FORGE + SENTINEL Unified Launch        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check dependencies
echo -e "${CYAN}Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing...${NC}"
    npm install -g pnpm
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 not found. Please install Python 3.12+${NC}"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}uv not found. Installing...${NC}"
    pip install uv
fi

echo -e "${GREEN}Dependencies OK${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# Start AURA Assistant (Node.js)
# ──────────────────────────────────────────────────────────────
echo -e "${CYAN}Starting AURA Assistant on port $AURA_PORT...${NC}"
cd /root/aura-assistant
if check_port $AURA_PORT; then
    echo -e "${YELLOW}Port $AURA_PORT already in use. AURA may already be running.${NC}"
else
    node server.js > /tmp/aura.log 2>&1 &
    AURA_PID=$!
    PIDS+=($AURA_PID)
    echo -e "${GREEN}AURA Assistant started (PID: $AURA_PID)${NC}"
fi

# ──────────────────────────────────────────────────────────────
# Start FORGE (pnpm workspace)
# ──────────────────────────────────────────────────────────────
echo -e "${CYAN}Starting FORGE services...${NC}"
cd /root/aura-assistant/FORGE

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing FORGE dependencies...${NC}"
    pnpm install --frozen-lockfile 2>&1 | tail -5
fi

# Setup database
echo -e "${CYAN}Setting up FORGE database...${NC}"
pnpm db:generate 2>&1 | tail -3
pnpm db:push 2>&1 | tail -3

# Start FORGE API
if check_port $FORGE_API_PORT; then
    echo -e "${YELLOW}FORGE API port $FORGE_API_PORT already in use.${NC}"
else
    pnpm --filter=@forge/api dev > /tmp/forge-api.log 2>&1 &
    FORGE_API_PID=$!
    PIDS+=($FORGE_API_PID)
    echo -e "${GREEN}FORGE API started (PID: $FORGE_API_PID)${NC}"
fi

# Start FORGE Web (on port 3001 to avoid conflict with AURA)
if check_port $FORGE_WEB_PORT; then
    echo -e "${YELLOW}FORGE Web port $FORGE_WEB_PORT already in use.${NC}"
else
    PORT=$FORGE_WEB_PORT pnpm --filter=@forge/web dev > /tmp/forge-web.log 2>&1 &
    FORGE_WEB_PID=$!
    PIDS+=($FORGE_WEB_PID)
    echo -e "${GREEN}FORGE Web started on port $FORGE_WEB_PORT (PID: $FORGE_WEB_PID)${NC}"
fi

# Start FORGE Worker
if check_port $FORGE_WORKER_PORT; then
    echo -e "${YELLOW}FORGE Worker port $FORGE_WORKER_PORT already in use.${NC}"
else
    pnpm --filter=@forge/worker dev > /tmp/forge-worker.log 2>&1 &
    FORGE_WORKER_PID=$!
    PIDS+=($FORGE_WORKER_PID)
    echo -e "${GREEN}FORGE Worker started (PID: $FORGE_WORKER_PID)${NC}"
fi

# ──────────────────────────────────────────────────────────────
# Start SENTINEL (Python FastAPI + Next.js)
# ──────────────────────────────────────────────────────────────
echo -e "${CYAN}Starting SENTINEL services...${NC}"
cd /root/aura-assistant/SENTINEL/sentinel

# Install Python dependencies with uv
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Creating SENTINEL virtual environment...${NC}"
    uv venv
fi

echo -e "${CYAN}Installing SENTINEL Python dependencies...${NC}"
uv pip install -e "apps/api[dev]" -e packages/schemas -e packages/security-sdk 2>&1 | tail -3

# Start SENTINEL API
if check_port $SENTINEL_API_PORT; then
    echo -e "${YELLOW}SENTINEL API port $SENTINEL_API_PORT already in use.${NC}"
else
    cd /root/aura-assistant/SENTINEL/sentinel/apps/api
    uv run uvicorn sentinel_api.main:app --host 0.0.0.0 --port $SENTINEL_API_PORT --reload > /tmp/sentinel-api.log 2>&1 &
    SENTINEL_API_PID=$!
    PIDS+=($SENTINEL_API_PID)
    echo -e "${GREEN}SENTINEL API started on port $SENTINEL_API_PORT (PID: $SENTINEL_API_PID)${NC}"
fi

# Start SENTINEL Web (on port 3002 to avoid conflicts)
cd /root/aura-assistant/SENTINEL/sentinel/apps/web
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing SENTINEL Web dependencies...${NC}"
    pnpm install 2>&1 | tail -3
fi

if check_port $SENTINEL_WEB_PORT; then
    echo -e "${YELLOW}SENTINEL Web port $SENTINEL_WEB_PORT already in use.${NC}"
else
    PORT=$SENTINEL_WEB_PORT pnpm dev > /tmp/sentinel-web.log 2>&1 &
    SENTINEL_WEB_PID=$!
    PIDS+=($SENTINEL_WEB_PID)
    echo -e "${GREEN}SENTINEL Web started on port $SENTINEL_WEB_PORT (PID: $SENTINEL_WEB_PID)${NC}"
fi

# ──────────────────────────────────────────────────────────────
# Wait for all services to be ready
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Waiting for services to be ready...${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"

wait_for_service "AURA Assistant" "http://localhost:$AURA_PORT/api/status"
wait_for_service "FORGE API" "http://localhost:$FORGE_API_PORT/health"
wait_for_service "FORGE Web" "http://localhost:$FORGE_WEB_PORT"
wait_for_service "SENTINEL API" "http://localhost:$SENTINEL_API_PORT/health"
wait_for_service "SENTINEL Web" "http://localhost:$SENTINEL_WEB_PORT"

# ──────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    ALL SERVICES RUNNING                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│ Service              │ URL                                  │${NC}"
echo -e "${GREEN}├─────────────────────────────────────────────────────────────┤${NC}"
echo -e "${GREEN}│ AURA Assistant       │ http://localhost:$AURA_PORT                    │${NC}"
echo -e "${GREEN}│ FORGE API            │ http://localhost:$FORGE_API_PORT                   │${NC}"
echo -e "${GREEN}│ FORGE Web Dashboard  │ http://localhost:$FORGE_WEB_PORT                    │${NC}"
echo -e "${GREEN}│ SENTINEL API         │ http://localhost:$SENTINEL_API_PORT                  │${NC}"
echo -e "${GREEN}│ SENTINEL Web         │ http://localhost:$SENTINEL_WEB_PORT                    │${NC}"
echo -e "${GREEN}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "${CYAN}Logs:${NC}"
echo -e "  AURA:       tail -f /tmp/aura.log"
echo -e "  FORGE API:  tail -f /tmp/forge-api.log"
echo -e "  FORGE Web:  tail -f /tmp/forge-web.log"
echo -e "  FORGE Worker: tail -f /tmp/forge-worker.log"
echo -e "  SENTINEL API: tail -f /tmp/sentinel-api.log"
echo -e "  SENTINEL Web: tail -f /tmp/sentinel-web.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running and show combined logs
echo -e "${CYAN}Showing combined logs (Ctrl+C to stop)...${NC}"
echo ""

# Tail all logs
tail -f /tmp/aura.log /tmp/forge-api.log /tmp/forge-web.log /tmp/forge-worker.log /tmp/sentinel-api.log /tmp/sentinel-web.log 2>/dev/null &
TAIL_PID=$!
PIDS+=($TAIL_PID)

# Wait for all background processes
wait