#!/bin/bash
# ===========================================
# Development Helper Script
# ===========================================
# Fast rebuilds without OCI export delays
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

case "$1" in
  frontend)
    echo -e "${YELLOW}⚡ Building frontend locally and copying to container...${NC}"
    cd frontend
    npm run build
    docker cp dist/. printer-frontend:/usr/share/nginx/html/
    docker exec printer-frontend nginx -s reload
    echo -e "${GREEN}✅ Frontend updated in ~5 seconds!${NC}"
    ;;
    
  backend)
    echo -e "${YELLOW}⚡ Copying backend source to container...${NC}"
    docker cp backend/src/. printer-backend:/app/src/
    docker exec printer-backend kill -HUP 1 2>/dev/null || docker-compose restart backend
    echo -e "${GREEN}✅ Backend updated!${NC}"
    ;;
    
  logs)
    docker-compose logs -f --tail=50 backend frontend
    ;;
    
  rebuild)
    echo -e "${YELLOW}🔨 Full rebuild (use sparingly)...${NC}"
    DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker-compose build "$2"
    docker-compose up -d "$2"
    echo -e "${GREEN}✅ Rebuild complete${NC}"
    ;;
    
  status)
    echo -e "${YELLOW}📊 Container Status:${NC}"
    docker-compose ps
    echo ""
    echo -e "${YELLOW}📊 Health Checks:${NC}"
    docker exec printer-backend curl -s http://localhost:3000/api/system/health | head -c 100
    echo ""
    ;;
    
  *)
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  frontend  - Build frontend locally and copy to container (fast!)"
    echo "  backend   - Copy backend source to container"
    echo "  logs      - Tail logs from backend and frontend"
    echo "  rebuild   - Full docker-compose build (slower)"
    echo "  status    - Show container status"
    echo ""
    echo "Example:"
    echo "  ./dev.sh frontend   # Update frontend in ~5 seconds"
    ;;
esac
