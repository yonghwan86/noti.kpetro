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
- `/api/categories` - Category management
- `/api/users` - User management
- `/api/assets` - Asset CRUD and inspection operations
- `/api/logs` - Inspection history and audit trails

**Authentication & Authorization**: 
- Currently uses a simplified session-based approach with user ID stored in localStorage and passed via `x-user-id` header
- Role-based access control (RBAC) with three roles: admin, manager, staff
- Permission middleware (`requireAuth`) enforces role requirements on protected routes
- Authorization logic is centralized in `server/auth.ts`

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
- **categories**: Asset categories for classification
- **users**: System users with roles and team assignments
- **assets**: Equipment assets with detailed tracking fields including:
  - Basic info (name, serial number)
  - Category and team relationships
  - Manager and staff assignments
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
- Session management prepared for connect-pg-simple (PostgreSQL session store) though simplified auth is currently active
- Build process bundles specific server dependencies to optimize cold start performance on serverless platforms