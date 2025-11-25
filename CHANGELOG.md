# Changelog

All notable changes to Alta WMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Mobile barcode scanning integration
- Advanced analytics dashboards
- Multi-warehouse support
- API rate limiting
- Automated backup system

## [2.1.0] - 2025-11-25

### Added
- **New Shipping Status Flow**: Implemented comprehensive status tracking
  - KREIRAN (Created) - Yellow badge for newly synced orders
  - DODELJENO (Assigned) - Green badge when assigned to worker/team
  - U RADU (In Progress) - Orange badge when worker starts
  - Complete workflow through PRIPREMLJENO, UTOVARENO, ZATVORENO
- **Team Member Visibility**: Display all team members in shipping assignment modals
- **Store Destination Tracking**: Show destination store (Prodavnica) across all shipping views
- **Sorting Enhancement**: Assigned orders automatically move to top of list
- **Team Assignment Modal**: Added store name display for team-based assignments

### Changed
- Updated shipping import to set initial status as CREATED instead of PICKING
- Modified workforce assignment to transition CREATED → ASSIGNED → PICKING
- Enhanced status badge colors for better visual distinction
- Improved shipping dashboard with store name in yellow highlight

### Fixed
- Pantheon sync 503 errors due to missing environment variables
- Environment variable persistence after container rebuilds
- Password escaping in Docker Compose configuration
- Worker assignment modal scrolling for long order lists

## [2.0.0] - 2025-11-20

### Added
- **Pantheon ERP Integration**: Full bidirectional sync with Pantheon system
  - Manual sync button for on-demand document import
  - Warehouse filtering (Veleprodajni Magacin, Tranzitno skladiste)
  - Date range filtering (last 24 hours)
  - Automatic order creation from Pantheon documents
- **Team Management System**: Complete team-based workflow
  - Team creation and member management
  - Team-based task assignment with ANY_DONE/ALL_DONE policies
  - Team performance ranking
  - Multi-member task tracking
- **Workforce Dashboard**: Real-time operations monitoring
  - Active workers view with current assignments
  - Team rankings and performance metrics
  - Task assignment interface for managers
  - Live status updates via WebSockets

### Changed
- Refactored shipping service for better status management
- Enhanced API client with automatic token refresh
- Improved error handling across all modules
- Updated UI theme to dark mode with yellow accents

### Fixed
- CORS issues with multiple frontend origins
- JWT token expiration handling
- Database connection pooling
- File upload size limits

## [1.5.0] - 2025-11-10

### Added
- **Receiving Module**: Complete inbound workflow
  - Excel import from Pantheon
  - Discrepancy management with required notes
  - Photo documentation for receiving docs
  - Status tracking: DRAFT → IN_PROGRESS → COMPLETED
- **Shipping Module**: Outbound order management
  - Pick, stage, load, close workflow
  - Line-by-line picking with location tracking
  - Inventory deduction on pick
  - Order progress tracking
- **Analytics Dashboard**: KPIs and metrics
  - Receiving performance metrics
  - Shipping throughput
  - Worker productivity
  - Exception tracking

### Changed
- Database schema optimized for performance
- API endpoints restructured for consistency
- Frontend components refactored to TypeScript
- Improved mobile responsiveness

## [1.0.0] - 2025-10-15

### Added
- **Core Platform**: Initial release
  - User authentication with JWT
  - Role-based access control (5 roles)
  - PostgreSQL database with TypeORM
  - Docker containerization
- **Master Data Management**:
  - Items catalog with SKU and barcode
  - Suppliers management
  - Inventory tracking by location
  - Warehouse hierarchy (Zone → Aisle → Rack → Position)
- **Interactive Warehouse Map**:
  - SVG-based visual representation
  - Click-to-navigate to locations
  - Zone highlighting
  - Mobile-optimized
- **Admin Panel**: Desktop management interface
  - Dashboard with KPIs
  - User management
  - Item catalog management
  - Inventory views
- **PWA Application**: Mobile worker interface
  - Offline-capable
  - Barcode scanning ready
  - Touch-optimized UI
  - Installation prompts

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Role-based route guards
- SQL injection prevention
- XSS protection headers

## Development Milestones

### Phase 0 - Foundation ✅
- Platform architecture
- Authentication system
- Database setup
- Docker infrastructure

### Phase 1 - Master Data ✅
- Items & suppliers
- Inventory management
- Warehouse structure
- Location hierarchy

### Phase 2 - Warehouse Operations ✅
- Interactive warehouse map
- Location management
- Stock movements
- Real-time updates

### Phase 3 - Receiving ✅
- Document import
- Item scanning
- Quality checks
- Photo documentation

### Phase 4 - Shipping ✅
- Order fulfillment
- Pick-to-light workflow
- Loading management
- Delivery confirmation

### Phase 5 - Advanced Features ✅
- Team management
- Workforce analytics
- ERP integration
- Real-time dashboards

### Phase 6 - Enterprise (In Progress)
- Multi-warehouse support
- Advanced reporting
- API webhooks
- Third-party integrations

## Upgrade Guide

### From 1.x to 2.x

**Breaking Changes:**
- Database schema changes require migration
- API endpoint restructuring
- New environment variables required

**Migration Steps:**
```bash
# 1. Backup database
./scripts/db-backup.sh

# 2. Pull latest code
git pull origin main

# 3. Run migrations
cd backend && npm run migration:run

# 4. Update environment variables
# Add: CUNGU_API_ENABLED, CUNGU_API_URL, etc.

# 5. Restart services
docker compose -f docker-compose.prod.yml up -d --build
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/Doppler617492/AltaWmsProject/issues
- Email: support@cungu.com
- Documentation: See README.md

---

[Unreleased]: https://github.com/Doppler617492/AltaWmsProject/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Doppler617492/AltaWmsProject/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Doppler617492/AltaWmsProject/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/Doppler617492/AltaWmsProject/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/Doppler617492/AltaWmsProject/releases/tag/v1.0.0
