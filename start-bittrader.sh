#!/bin/bash

# BitTrader Pro - Easy Launch Script
# ===================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}=================================================="
echo "       BitTrader Pro - Bitcoin Trading Platform"
echo "==================================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}[1/4] Checking environment...${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}ERROR: .env file not found!${NC}"
    echo "Creating default .env file..."
    cat > .env << 'EOF'
DATABASE_URL="your_database_url_here"
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
EOF
    echo -e "${YELLOW}Please edit .env with your database credentials${NC}"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a
echo -e "${GREEN}   Environment loaded${NC}"

echo -e "${YELLOW}[2/4] Checking dependencies...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies (first time setup)...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to install dependencies${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}   Dependencies ready${NC}"

echo -e "${YELLOW}[3/4] Checking for port conflicts...${NC}"

# Kill any existing process on port 3001
if lsof -i :3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}   Port 3001 in use, stopping existing process...${NC}"
    kill $(lsof -t -i :3001) 2>/dev/null
    sleep 1
fi
echo -e "${GREEN}   Port 3001 available${NC}"

echo -e "${YELLOW}[4/4] Starting BitTrader Pro...${NC}"
echo ""
echo -e "${GREEN}=================================================="
echo "   Dashboard: http://localhost:3001"
echo "   Press Ctrl+C to stop the server"
echo "==================================================${NC}"
echo ""

# Open browser after a delay (in background)
(sleep 5 && open "http://localhost:3001") &

# Start the development server
npm run dev
