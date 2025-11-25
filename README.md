# Alta WMS - Enterprise Warehouse Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

> Modern, scalable warehouse management system built with Next.js, NestJS, and PostgreSQL, featuring real-time operations tracking, team management, and enterprise Pantheon ERP integration.

## 🌟 Overview

Alta WMS is a comprehensive warehouse management solution designed for modern distribution centers and retail operations. It provides end-to-end visibility of warehouse operations, from receiving to shipping, with advanced features like real-time status tracking, team-based task assignment, and seamless ERP integration.

### Key Features

- 🚀 **Real-time Operations Tracking** - Live status updates across all warehouse activities
- 👥 **Team Management** - Assign tasks to teams or individual workers with flexible policies
- 📦 **Receiving & Shipping** - Complete inbound/outbound workflows with discrepancy management
- 🏢 **Pantheon ERP Integration** - Automated document sync and order management
- 📊 **Analytics Dashboard** - KPIs, performance metrics, and operational insights
- 🗺️ **Interactive Warehouse Map** - Visual location management and navigation
- 📱 **PWA Support** - Mobile-optimized for warehouse floor operations
- 🔐 **Enterprise Security** - Role-based access control with JWT authentication

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Features](#-features)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [License](#-license)

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 14+ (if running without Docker)

### Running with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/Doppler617492/AltaWmsProject.git
cd AltaWmsProject

# Start all services
docker compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Admin Panel: http://localhost:3001
```

### Default Credentials

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Admin | `admin` | `admin` | Full system access |
| Warehouse Manager | `sef` | `admin` | Warehouse operations, team management |
| Manager | `menadzer` | `admin` | Analytics, reporting, workforce management |
| Warehouse Worker | `magacioner` | `admin` | Assigned tasks, order fulfillment |
| Commercial | `komercijalista` | `admin` | Order creation, customer management |

### First Login

If you see "401 Unauthorized" errors:

1. Open Developer Console (F12)
2. Run: `localStorage.clear();`
3. Refresh page (F5)
4. Login with credentials above

## 🏗️ Architecture

Alta WMS follows a modern microservices architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Admin Panel (Next.js)  │  PWA App (Next.js)  │  TV Display │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (NestJS)                      │
├─────────────────────────────────────────────────────────────┤
│  Auth │ Receiving │ Shipping │ Workforce │ Integrations     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (PostgreSQL + TypeORM)               │
├─────────────────────────────────────────────────────────────┤
│  Users │ Items │ Inventory │ Orders │ Teams │ Analytics     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              External Integrations                           │
├─────────────────────────────────────────────────────────────┤
│           Pantheon ERP  │  Label Printers  │  Scanners      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Backend
- **Framework**: NestJS 10.x (Node.js TypeScript framework)
- **Database**: PostgreSQL 14+ with TypeORM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: WebSockets for live updates
- **File Processing**: Multer + xlsx for Excel parsing
- **API Documentation**: Swagger/OpenAPI

#### Frontend
- **Framework**: Next.js 14.x (React 18)
- **PWA**: Service Workers, offline support
- **Styling**: Tailwind CSS + custom components
- **State Management**: React Context + Hooks
- **API Client**: Axios with interceptors

#### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Process Manager**: PM2 (for non-Docker deployments)
- **Monitoring**: Custom health checks + logging

## ✨ Features

### Warehouse Operations

#### Receiving Management
- **Document Import**: Excel import from Pantheon ERP
- **Status Tracking**: Draft → In Progress → Staged → Completed
- **Discrepancy Handling**: Automatic detection and required notes for variances
- **Photo Documentation**: Attach photos to receiving documents
- **Bulk Operations**: Process multiple items simultaneously

#### Shipping Management
- **Order Fulfillment**: Pick, stage, load, and close workflows
- **Status Flow**:
  - **KREIRAN** (Created) - Imported from Pantheon, awaiting assignment
  - **DODELJENO** (Assigned) - Assigned to team or worker
  - **U RADU** (In Progress) - Worker actively picking
  - **PRIPREMLJENO** (Staged) - Ready for loading
  - **UTOVARENO** (Loaded) - On vehicle
  - **ZATVORENO** (Closed) - Delivered and confirmed
- **Store Destination Tracking**: Full visibility of destination stores
- **Inventory Integration**: Real-time stock updates during picking

#### Inventory Management
- **Location Tracking**: Hierarchical (Zone → Aisle → Rack → Position)
- **Stock Movements**: Complete audit trail of all movements
- **Cycle Counting**: Scheduled and ad-hoc inventory counts
- **Hot Spots**: Identify high-activity locations

### Team Management

- **Flexible Assignment**: Assign to individuals or entire teams
- **Completion Policies**:
  - **ANY_DONE**: Task completes when any team member finishes
  - **ALL_DONE**: Task requires all members to complete
- **Real-time Tracking**: Live status of all team assignments
- **Performance Metrics**: Individual and team productivity

### Workforce Dashboard

- **Active Tasks**: Real-time view of all ongoing operations
- **Team Rankings**: Performance-based team leaderboards
- **Worker Status**: See who's working on what
- **Shift Management**: Track worker shifts and availability

### Analytics & Reporting

- **KPI Dashboard**: Key performance indicators at a glance
- **SLA Monitoring**: Track service level compliance
- **Performance Reports**: Worker and team productivity metrics
- **Exception Tracking**: Identify and resolve operational issues
- **Custom Reports**: Export data in multiple formats (CSV, PDF, Excel)

### Pantheon ERP Integration

- **Automatic Sync**: Scheduled or manual document synchronization
- **Warehouse Filtering**: Sync only relevant warehouses
- **Date Range Control**: Sync last 24 hours or custom range
- **Error Handling**: Graceful handling of API failures
- **Credential Management**: Secure credential storage

### Security & Compliance

- **Role-Based Access Control**: 5 distinct roles with granular permissions
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Automatic token refresh and expiry
- **Audit Logging**: Complete history of all system actions
- **Data Encryption**: Secure storage of sensitive information

## 📥 Installation

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production setup instructions.

Quick production setup:

```bash
# 1. Clone repository on server
git clone https://github.com/Doppler617492/AltaWmsProject.git /opt/alta-wms
cd /opt/alta-wms

# 2. Copy and configure environment file
cp env.production.example .env
nano .env  # Configure your settings

# 3. Build and start services
docker compose -f docker-compose.prod.yml up -d --build

# 4. Check status
docker compose -f docker-compose.prod.yml ps
```

### Development Setup

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../frontend-pwa && npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# 3. Start database
docker compose up -d db

# 4. Run migrations
cd backend && npm run migration:run

# 5. Seed data (optional)
npm run seed

# 6. Start development servers
# Terminal 1: Backend
cd backend && npm run start:dev

# Terminal 2: Frontend Admin
cd frontend && npm run dev

# Terminal 3: Frontend PWA
cd frontend-pwa && npm run dev
```

## ⚙️ Configuration

### Environment Variables

#### Backend (`backend/.env`)

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=alta_wms
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=3d

# Pantheon ERP Integration
CUNGU_API_ENABLED=true
CUNGU_API_URL=http://cungu.pantheonmn.net:3003
CUNGU_API_USERNAME=CunguWMS
CUNGU_API_PASSWORD=your_pantheon_password
CUNGU_SYNC_PAGE_SIZE=500
CUNGU_SHIPPING_METHOD=GetIssueDocWMS

# Application
PORT=8000
NODE_ENV=production
```

#### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_PWA_URL=http://localhost:3002
```

### Nginx Configuration

For production deployment with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name admin.cungu.com;

    ssl_certificate /etc/letsencrypt/live/cungu.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cungu.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📚 API Documentation

### Authentication

All API endpoints (except `/auth/login` and `/health`) require JWT authentication.

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "ADMIN",
    "fullName": "System Admin"
  }
}
```

#### Authenticated Requests
```http
GET /shipping/active
Authorization: Bearer <your_token>
```

### Core Endpoints

#### Shipping Orders

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/shipping/active` | List active shipping orders | `shipping:read` |
| GET | `/shipping/order/:id` | Get order details | `shipping:read` |
| POST | `/shipping/import` | Import from Excel | `shipping:write` |
| PATCH | `/shipping/order/:id/stage` | Mark order as staged | `shipping:write` |
| PATCH | `/shipping/order/:id/load` | Mark order as loaded | `shipping:write` |
| PATCH | `/shipping/order/:id/close` | Close order | `shipping:write` |

#### Receiving Documents

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/receiving/active` | List active receiving docs | `receiving:read` |
| POST | `/receiving/import` | Import from Excel | `receiving:write` |
| PATCH | `/receiving/:id/start` | Start receiving | `receiving:write` |
| PATCH | `/receiving/:id/complete` | Complete receiving | `receiving:write` |

#### Workforce Management

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/workforce/assign-task` | Assign task to worker/team | `workforce:write` |
| GET | `/workforce/teams` | List all teams | `workforce:read` |
| GET | `/workforce/task-assignees/:type/:id` | Get task assignments | `workforce:read` |
| POST | `/workforce/assignee/:id/start` | Worker starts task | - |
| POST | `/workforce/assignee/:id/complete` | Worker completes task | - |

#### Pantheon Integration

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/integrations/cungu/sync` | Sync documents from Pantheon | `admin` |
| GET | `/integrations/cungu/status` | Check integration status | `admin` |

For complete API documentation, visit `/api/docs` when running the backend server.

## 🛠️ Development

### Project Structure

```
alta-wms/
├── backend/                # NestJS backend application
│   ├── src/
│   │   ├── auth/          # Authentication module
│   │   ├── shipping/      # Shipping operations
│   │   ├── receiving/     # Receiving operations
│   │   ├── workforce/     # Team & worker management
│   │   ├── integrations/  # Pantheon ERP integration
│   │   ├── entities/      # TypeORM database entities
│   │   └── migrations/    # Database migrations
│   ├── Dockerfile
│   └── package.json
├── frontend/              # Admin panel (Next.js)
│   ├── components/        # React components
│   ├── pages/            # Next.js pages
│   ├── lib/              # Utilities & API client
│   ├── services/         # API service layer
│   └── package.json
├── frontend-pwa/         # Worker PWA application
│   ├── components/
│   ├── pages/
│   └── package.json
├── frontend-tv/          # TV dashboard display
├── docker/               # Docker configuration files
├── docs/                 # Additional documentation
├── scripts/              # Utility scripts
└── docker-compose.yml    # Docker Compose configuration
```

### Running Tests

```bash
# Backend unit tests
cd backend
npm run test

# Backend e2e tests
npm run test:e2e

# Frontend tests
cd frontend
npm run test

# Run all tests
npm run test:all
```

### Code Quality

```bash
# Lint backend
cd backend && npm run lint

# Lint frontend
cd frontend && npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Database Migrations

```bash
# Generate new migration
cd backend
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## 🚢 Deployment

### Production Checklist

- [ ] Update all default passwords
- [ ] Configure SSL certificates
- [ ] Set strong JWT_SECRET
- [ ] Configure Pantheon credentials
- [ ] Set up database backups
- [ ] Configure Nginx reverse proxy
- [ ] Enable firewall rules
- [ ] Set up monitoring/logging
- [ ] Test all integrations
- [ ] Document custom configurations

### Monitoring

The system includes health check endpoints:

```bash
# Backend health
curl http://localhost:8000/health

# Frontend health (via API proxy)
curl http://localhost:3000/api/health
```

### Backup & Restore

```bash
# Backup database
./scripts/db-backup.sh

# Restore database
./scripts/db-restore.sh backup-file.sql

# Backup uploaded files
./scripts/backup.sh
```

## 🧪 Testing

### Test Coverage

- Unit Tests: Core business logic
- Integration Tests: API endpoints
- E2E Tests: Critical user workflows
- Performance Tests: Load testing for high-traffic scenarios

### Running Specific Tests

```bash
# Test specific module
npm run test -- shipping.service

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

## 📖 Additional Documentation

- [Architecture Deep Dive](./ARCHITECTURE.md) - Detailed system architecture
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [Quick Start Guide](./QUICK_START.md) - Get started in 5 minutes
- [Operations Manual](./deployment/OPERATIONS.md) - Day-to-day operations
- [Runbooks](./deployment/RUNBOOKS.md) - Common issue resolution
- [Pantheon Integration Setup](./CUNGU_SYNC_SETUP.md) - ERP integration guide
- [Enterprise Readiness](./ENTERPRISE_READINESS.md) - Enterprise deployment guide

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features
- Update documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- Database: [PostgreSQL](https://www.postgresql.org/)
- Containerization: [Docker](https://www.docker.com/)

## 📞 Support

For enterprise support and custom development:
- Email: support@cungu.com
- Documentation: https://docs.cungu.com
- Issue Tracker: https://github.com/Doppler617492/AltaWmsProject/issues

---

**Alta WMS** - Powering Modern Warehouse Operations
