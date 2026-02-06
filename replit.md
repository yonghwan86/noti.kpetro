# 장비관리시스템 (Asset Management System)

## Overview

This is a full-stack asset management and calibration tracking system built with React, Express, and PostgreSQL. The application helps organizations manage equipment assets, track inspection schedules, and monitor calibration compliance across multiple teams and users. It features role-based access control (admin, manager, staff), automated status tracking based on inspection due dates, and comprehensive audit logging.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component System**: Built on shadcn/ui components with Radix UI primitives, styled using Tailwind CSS with custom theme variables. The design follows the "new-york" style variant with neutral base colors and CSS variables for theming.

**State Management**: 
- TanStack Query (React Query) for server state management and API data caching
- React Context API for user session management (UserContext provides current user, team, and user switching functionality)
- Local Storage for persisting current user selection across sessions

**Routing**: Wouter for lightweight client-side routing with the following main routes:
- `/` - Dashboard with statistics and charts
- `/assets` - Asset management interface
- `/team` - Team and user management
- `/settings` - System configuration
- `/logs` - Activity and inspection logs

**Form Handling**: React Hook Form with Zod schema validation for type-safe form management.

**Client-Side Authorization**: Permission checks are performed both client-side (for UI visibility) and mirrored server-side (for API security). The auth utility provides role-based permission methods (canViewAsset, canEditAsset, canDeleteAsset, etc.).

**Path Aliases**: Configured for clean imports:
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`
- `@assets/` maps to `attached_assets/`

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**API Design**: RESTful API structure with resource-based endpoints:
- `/api/teams` - Team CRUD operations
- `/api/users` - User management
- `/api/assets` - Asset CRUD and inspection operations
- `/api/logs` - Inspection history and audit trails

**Authentication & Authorization**: 
- Uses Replit Auth (OpenID Connect) for secure login via Google, GitHub, or Apple
- Pre-registration workflow: Admin creates users with email addresses, users login with Replit Auth, system matches by email
- Session management via express-session with PostgreSQL session store (connect-pg-simple)
- Database tables: `sessions` for session storage, `users.replit_id` links Replit identity to app users
- Role-based access control (RBAC) with three roles: admin (마스터), manager (장비관리자), staff (담당자)
- Permission middleware (`requireAuth`) enforces role requirements on protected routes
- Authorization logic is centralized in `server/auth.ts`
- Auth routes: `/api/login` (login), `/api/logout` (logout), `/api/auth/user` (get current user)

**Business Logic**: 
- Asset status calculation is automated based on inspection due dates (ok, upcoming within 7 days, overdue)
- Inspection cycle tracking uses months as the unit
- Date calculations use date-fns library for reliable date arithmetic

**Development Mode**: Uses Vite middleware in development for HMR (Hot Module Replacement) with custom error handling that exits the process on Vite errors.

**Production Build**: 
- Client built with Vite to `dist/public`
- Server bundled with esbuild to `dist/index.cjs`
- Selected dependencies bundled (allowlist in build script) to reduce cold start times
- Static file serving handled by Express in production

### Data Storage

**Database**: PostgreSQL with Drizzle ORM for type-safe database access.

**Schema Design** (defined in `shared/schema.ts`):
- **teams**: Organization teams with contact information
- **categories**: Asset categories (legacy table, no longer actively used - replaced by manager-based classification)
- **users**: System users with roles and team assignments; managers represent equipment types (장비 구분)
- **assets**: Equipment assets with detailed tracking fields including:
  - Basic info (name, serial number)
  - Team relationships (managing team and usage team)
  - Manager assignment (doubles as equipment type classification)
  - Staff assignment (person in charge)
  - Inspection cycle configuration
  - Date tracking (last inspected, next due)
  - Computed status field
  - Optional notes
  - categoryId (nullable, legacy field)
- **inspectionLogs**: Historical record of inspections performed

**Key Relationships**:
- Assets have two team relationships: managing team (teamId) and usage team (usageTeamId)
- Assets link to a manager (equipment manager) and staff (person in charge)
- Foreign key constraints ensure referential integrity
- UUID primary keys generated via PostgreSQL's `gen_random_uuid()`

**Schema Validation**: Drizzle-Zod integration provides runtime validation schemas that mirror the database schema, ensuring type safety from database to API to client.

**Migrations**: Drizzle Kit manages schema migrations with files stored in `./migrations` directory.

### External Dependencies

**Primary Framework Dependencies**:
- `express` - Web server framework
- `react` & `react-dom` - UI library
- `vite` - Build tool and dev server
- `drizzle-orm` - Database ORM
- `pg` - PostgreSQL client

**UI Component Libraries**:
- `@radix-ui/*` - Headless UI primitives (35+ components)
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library
- `class-variance-authority` & `clsx` - Conditional styling utilities
- `recharts` - Charting library for dashboard visualizations

**Form & Validation**:
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `@hookform/resolvers` - Zod integration for forms
- `drizzle-zod` - Database schema to Zod validation

**Date Handling**:
- `date-fns` - Date manipulation and formatting

**Development Tools**:
- `tsx` - TypeScript execution for Node.js
- `@replit/*` plugins - Replit-specific development enhancements (error overlay, dev banner, cartographer)

**Database Connection**:
- Connection string from `DATABASE_URL` environment variable
- Connection pooling via `pg.Pool`

**Notable Architectural Decisions**:
- Shared schema definitions between client and server prevent type drift
- Mock data utility exists but application is designed to work with real database
- Session management uses connect-pg-simple (PostgreSQL session store) for secure session persistence
- Build process bundles specific server dependencies to optimize cold start performance on serverless platforms

## Recent Changes

### February 2026 - Equipment Type Registration Workflow & Role Permissions
- Renamed "관리자" tab to "장비 구분" tab with dedicated equipment type registration interface
- Added `AddEquipTypeDialog` with simplified form (defaults role to manager, no role selector)
- Added `AddMasterAccountDialog` for admin to create additional admin (마스터) accounts
- Added `canAccessTeamPage` permission to allow both admin and manager roles to access Team page
- Admin sees both tabs (장비 구분 + 사용자); Manager sees only 사용자 tab
- Updated API routes: POST/PATCH/DELETE /api/teams now allow both admin and manager roles
- Navigation label updated from "사용자 관리" to "장비 구분 관리" across Sidebar and Header
- Manager dropdowns/lists consistently filter to show only role='manager' users (excludes admins)
- Login flow: email/password auth (emailAuth.ts) - user created with email, sets password on first login

### February 2026 - Manager-based Classification & Category Removal
- Removed two-level category system (카테고리 → 관리 장비명), replaced with single-level manager-based classification (장비 구분)
- Made assets.categoryId nullable in database schema
- Removed all category CRUD API routes, Excel export/import/template routes
- Updated Assets page: removed category filter/column/management, replaced with manager-based filtering
- Updated Dashboard: replaced category distribution chart with manager-based equipment distribution
- Excel import supports backward compatibility - accepts "장비 구분", "장비관리자", or legacy "카테고리" column names

### February 2026 - Automated Email Notifications
- Added Gmail integration using Replit Google Mail connector
- Created `server/emailService.ts` for sending HTML emails via Gmail API
- Created `server/scheduler.ts` with node-cron for daily inspection checks
- Scheduler runs at 9:00 AM KST daily to check for assets with inspections due within 7 days
- Automatic email reminders sent to team contact emails for upcoming inspections
- Admin API endpoint `/api/email/check-inspections` for manual trigger
- Email templates use Korean content with proper UTF-8 encoding

### January 2026 - Replit Auth Integration
- Integrated Replit Auth (OpenID Connect) for secure user authentication
- Added `sessions` table for session storage
- Added `replit_id` column to users table for linking Replit identities
- Created Login page (`client/src/pages/Login.tsx`) that shows for unauthenticated users
- Updated `UserContext` to check authentication status from `/api/auth/user`
- Updated `requireAuth` middleware to use session-based auth instead of x-user-id header
- Authentication flow: Admin pre-registers users with email → Users login via Replit → System matches by email and links Replit ID
- Admin can edit user email and phone numbers via Team management page