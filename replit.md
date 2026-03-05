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
- Email notifications via Gmail API (Google Mail Replit Integration), not SMTP
- Role-based access control (RBAC) with three roles: admin (마스터), manager (구분 관리자), staff (담당자)
- Permission middleware (`requireAuth`) enforces role requirements on protected routes
- Authorization logic is centralized in `server/auth.ts` and `client/src/lib/auth.ts`
- Permission matrix:
  - Admin: Full access to all features
  - Manager: Category CRUD (own categories only), Asset CRUD + delete (own assets only), Staff management (assigned staff)
  - Staff: Asset add/edit (own assets only), Inspection execution
- Auth routes: `/api/login` (login), `/api/logout` (logout), `/api/auth/user` (get current user)

**Business Logic**: 
- Asset status calculation is automated based on inspection due dates (ok, upcoming within 7 days, overdue)
- Inspection cycle tracking uses days as the unit (n-1 calculation with weekend adjustment)
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
- **categories**: Equipment type classifications with `managerIds` (text array) supporting multiple manager assignments per equipment type, and `defaultCycleDays` for auto-filling inspection cycle when registering assets
- **users**: System users with roles and team assignments; managers are promoted from staff users; `assignedCategoryIds` (text array) tracks which categories a staff member is assigned to under their manager
- **assets**: Equipment assets with detailed tracking fields including:
  - Basic info (name, serial number)
  - Team relationships (managing team and usage team)
  - Category reference (categoryId) linking to equipment type
  - Single manager assignment (managerId) - auto-set from category's managers, user-selectable when category has multiple managers
  - Staff assignment (person in charge)
  - Inspection cycle configuration
  - Date tracking (last inspected, next due)
  - Computed status field
  - Optional notes
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

### February 2026 - Inspection Cycle Refactor: Months to Days
- Changed inspection cycle from months-based to days-based calculation
- Database column renamed: `inspection_cycle_months` → `inspection_cycle_days`
- Added preset dropdown selector: 7일 (1주), 14일 (2주), 30일 (1개월), 90일 (3개월), 180일 (6개월), 365일 (1년), 730일 (2년), 직접 지정 (custom)
- Implemented n-1 date calculation: next due = last inspected date + (cycle days - 1)
- Weekend adjustment: if calculated date falls on Saturday/Sunday, automatically moved to next Monday
- Live preview shows expected next inspection date with weekend adjustment indication
- Updated Excel import/export: column name changed from "점검주기(개월)" to "점검주기(일)", backward compatible import accepts old column name
- CycleSelector and InspectionCyclePreview reusable components added to Assets.tsx
- Edit dialog now includes cycle selector and last inspection date with live preview

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

### February 2026 - Staff User Account Management & Security
- "사용자" tab redesigned to manage individual staff accounts (role='staff') from users table
- Staff user list shows: 이름, 직책, 소속팀, 이메일, 전화번호, 로그인 상태 (설정완료/미설정/이메일없음)
- Added `position` (직책) field to users table for identifying team leaders
- Added AddStaffUserDialog for creating staff accounts with name, position, team, email, phone
- Added EditUserDialog for editing staff user details including position
- Login status based on `hasPassword` boolean field (derived server-side from passwordHash)
- Password reset option available for users who have already set passwords
- Security: passwordHash never exposed in API responses; replaced with `hasPassword: boolean`
- Security: Manager role restricted to staff-only operations (create/edit/delete/reset-password)
- Admin retains full access to all user operations
- Staff Excel export/import/template includes 직책 column

### February 2026 - Separated Equipment Types from Manager Users
- Major architectural change: manager users are now just people, equipment types stored separately in categories table
- Categories table (id, name, managerId) stores equipment types with assigned manager
- One manager can oversee multiple equipment types
- Assets reference both categoryId (equipment type) and managerId (person, auto-set from category)
- Team.tsx 장비 구분 tab: two-section layout with equipment types table and manager users table
- New dialogs: AddEquipTypeCategoryDialog (creates category with manager selection), EditCategoryDialog, AddManagerDialog
- Assets.tsx: equipment type filtering/display uses categoryId, auto-sets managerId from selected category
- Dashboard.tsx: equipment distribution chart groups by categories, clickable cards navigate to filtered asset views
- Excel export/import fully aligned with category-based model:
  - Asset export: "장비 구분" shows category name, separate "관리자" column shows manager name
  - Asset import: looks up categories by name, derives managerId from category
  - Manager export: only manager role users with simplified columns (이름, 소속팀, 이메일, 전화번호)
  - Category export/import: uses "장비 구분명" column name
  - Backward compatibility: accepts "장비 구분" or "카테고리" column names for asset import

### February 2026 - Automated Email Notifications
- Added Gmail integration using Replit Google Mail connector
- Created `server/emailService.ts` for sending HTML emails via Gmail API
- Created `server/scheduler.ts` with node-cron for daily inspection checks
- Scheduler runs at 9:00 AM KST daily to check for assets with inspections due within 7 days
- Automatic email reminders sent to team contact emails and team leaders (직책='팀장') for upcoming inspections
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