#!/bin/bash

# Alta WMS Deployment Script
# Usage: ./scripts/deploy.sh [--build] [--migrate]

set -e

COMPOSE_FILE="docker-compose.prod.yml"
BUILD=false
MIGRATE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD=true
            shift
            ;;
        --migrate)
            MIGRATE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./scripts/deploy.sh [--build] [--migrate]"
            exit 1
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting deployment...${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ .env file not found!${NC}"
    echo "Please create .env file from env.production.example"
    exit 1
fi

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed!${NC}"
    exit 1
fi

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    echo -e "${YELLOW}Pulling latest changes from git...${NC}"
    git pull || echo "Warning: Git pull failed or not a git repository"
fi

# Build images if requested
if [ "$BUILD" = true ]; then
    echo -e "${YELLOW}Building Docker images...${NC}"
    docker compose -f $COMPOSE_FILE build --no-cache
fi

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker compose -f $COMPOSE_FILE down

# Start containers
echo -e "${YELLOW}Starting containers...${NC}"
if [ "$BUILD" = true ]; then
    docker compose -f $COMPOSE_FILE up -d --build
else
    docker compose -f $COMPOSE_FILE up -d
fi

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Run migrations if requested
if [ "$MIGRATE" = true ]; then
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker compose -f $COMPOSE_FILE exec -T backend npm run typeorm migration:run || {
        echo -e "${YELLOW}Note: Migration command might not be available, skipping...${NC}"
    }
fi

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
docker compose -f $COMPOSE_FILE ps

# Health check
echo -e "${YELLOW}Performing health checks...${NC}"
sleep 5

# Check backend
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
fi

# Check database
if docker compose -f $COMPOSE_FILE exec -T db pg_isready -U wms_user > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is ready${NC}"
else
    echo -e "${RED}✗ Database is not ready${NC}"
fi

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}View logs with: docker compose -f $COMPOSE_FILE logs -f${NC}"

