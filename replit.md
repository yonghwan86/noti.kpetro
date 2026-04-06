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
- `/schedule` - Personal schedule management (내 일정)

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
- `/api/personal-tasks` - Personal schedule management
- `/api/push/*` - Web push subscription management
- `/api/email/*` - Email notification triggers

**Authentication & Authorization**: 
- Email/password authentication (`server/emailAuth.ts`) — users created by admin, set password on first login
- Session management via express-session with PostgreSQL session store (connect-pg-simple)
- `getCurrentUser(req)` reads `req.session.userId` → looks up user via `getUserById`
- `requireAuth` middleware sets `(req as any).currentUser` for downstream route handlers
- **Important**: All routes that need the current user must use `(req as any).currentUser`, NOT call `getCurrentUser(req)` again (it's async — calling without `await` returns a Promise, not a User)
- Role-based access control (RBAC) with three roles: admin (마스터), manager (구분 관리자), staff (담당자)
- Permission middleware (`requireAuth`) enforces role requirements on protected routes
- Authorization logic is centralized in `server/auth.ts` and `client/src/lib/auth.ts`
- Permission matrix:
  - Admin: Full access to all features
  - Manager: Category CRUD (own categories only), Asset CRUD + delete (own assets only), Staff management (assigned staff)
  - Staff: Asset add/edit (own assets only), Inspection execution

**Business Logic**: 
- Asset status calculation is automated based on inspection due dates: ok / upcoming (within 7 days, inclusive) / overdue
- **Status calculation**: `getAssets()` recalculates status dynamically at query time (does not rely on stored DB status column)
- **Upcoming boundary**: `isAfter(dueDate, today) && !isAfter(dueDate, sevenDaysFromNow)` — upper bound is INCLUSIVE (day 7 is included). Using `!isAfter` instead of `isBefore` to include the exact 7th day.
- Inspection cycle tracking uses days as the unit (n-1 calculation with weekend adjustment)
- Date calculations use date-fns library for reliable date arithmetic

**Development Mode**: Uses Vite middleware in development for HMR (Hot Module Replacement) with custom error handling that exits the process on Vite errors.

**Production Build**: 
- Client built with Vite to `dist/public`
- Server bundled with esbuild to `dist/index.cjs`
- Selected dependencies bundled (allowlist in build script) to reduce cold start times
- Static file serving handled by Express in production
- Deployment: Reserved VM, build=`npm run build`, run=`npm run start`
- Custom domain: `noti.kpetro.or.kr`

### Scheduler (`server/scheduler.ts`)

**Cron Jobs** (all in Asia/Seoul timezone):
- `0 9 * * *` (9 AM KST) — `runDailyCheckIfNeeded()` + `checkPersonalTasksMorning()`
- `* * * * *` (every minute) — `checkPersonalTasksReminder()` (10-min-before push)
- `0 18 * * *` (6 PM KST) — `sendOwnerTomorrowDigest()` + `sendSharedTasksEmailDigest()`
- `0 0 * * *` (midnight KST) — reset `morningNotified` / `reminderNotified` flags

**Server start catch-up logic**:
- If kstHour >= 9: run `runDailyCheckIfNeeded()` + `checkPersonalTasksMorning()`
- If kstHour >= 18: run `sendOwnerTomorrowDigest()`

**Idempotency keys** (stored in `system_settings` table):
- `last_email_date` — prevents duplicate inspection emails per day
- `last_owner_digest_date` — prevents duplicate personal task digest per day

**Email sending order**: `last_email_date` is recorded AFTER `checkUpcomingInspections()` completes (not before), so a server crash mid-send allows retry on next startup.

**Recipient collection** (`collectRecipients`):
1. Asset staff (staffId) — using their individual name in email greeting
2. Team leaders (position='팀장' in same team)
3. Team contact email (contactEmail)
4. Category manager IDs (category.managerIds array) — all managers, not just asset.managerId

**Email personalization**: `sendInspectionReminder(email, assetName, dueDate, staffName, teamName, recipientName?)` — greeting uses `recipientName` (looked up per recipient in the loop); staff name appears as a separate "담당자" field in the email body.

**Push recipient collection** (`collectPushRecipientIds`): staff + category.managerIds + asset.managerId

### Push Notifications (`server/pushService.ts`)

- Web Push protocol with VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env vars)
- `sendPushToUser(userId, title, body, url)` — looks up `push_subscriptions` by userId; logs and skips silently if no subscription found
- Expired subscriptions (HTTP 410/404) are auto-deleted from DB
- `client/src/components/PushNotificationToggle.tsx` — UI toggle in header for subscribing/unsubscribing
- Subscribe flow: request permission → get VAPID key → `pushManager.subscribe()` → POST `/api/push/subscribe` (response is checked; throws error if server save fails)
- Subscription status check: `registration.pushManager.getSubscription()` reflects browser-side state; server DB is the authoritative source for actual push delivery

### Data Storage

**Database**: PostgreSQL with Drizzle ORM for type-safe database access.

**Schema Design** (defined in `shared/schema.ts`):
- **teams**: Organization teams with contact information and a `department` text field (plain string, no separate departments table)
- **categories**: Equipment type classifications with `managerIds` (text array) supporting multiple manager assignments per equipment type, and `defaultCycleDays` for auto-filling inspection cycle when registering assets
- **users**: System users with roles and team assignments; `assignedCategoryIds` (text array) tracks which categories a staff member is assigned to; `username` is AES-256-GCM encrypted (prefix `enc:`)
- **assets**: Equipment assets with:
  - Basic info (name, serialNumber=추가정보, notes=추가정보2)
  - Team relationships (managing team `teamId` and usage team `usageTeamId`)
  - Category reference (`categoryId`)
  - Single manager assignment (`managerId`) — auto-set from category
  - Staff assignment (`staffId`)
  - Inspection cycle (`inspectionCycleDays`)
  - Date tracking (`lastInspectedDate`, `nextDueDate`)
  - Computed `status` field (recalculated dynamically in `getAssets()`)
- **inspectionLogs**: Historical record of inspections performed
- **personal_tasks**: Personal schedule items with sharing (shareScope: `'private' | 'selected'`, shareTeamIds, shareUserIds, notification flags: morningNotified, reminderNotified, emailDigestSent)
- **push_subscriptions**: Web Push subscription data (endpoint, p256dh, auth keys per user); `user_id` references users.id
- **system_settings**: Key-value store for idempotency flags (`last_email_date`, `last_owner_digest_date`, `encryption_migrated`)
- **sessions**: express-session PostgreSQL store

**Key Relationships**:
- Assets have two team relationships: managing team (teamId) and usage team (usageTeamId)
- Assets link to a manager (equipment manager) and staff (person in charge)
- Foreign key constraints ensure referential integrity
- UUID primary keys generated via PostgreSQL's `gen_random_uuid()`

**Schema Validation**: Drizzle-Zod integration provides runtime validation schemas that mirror the database schema.

**Migrations**: Drizzle Kit manages schema migrations with files stored in `./migrations` directory.

### Encryption

- AES-256-GCM encryption on `users.username` field
- `server/encryption.ts`: `encryptText()` / `decryptText()` using `ENCRYPTION_KEY` env var
- Encrypted values have prefix `enc:iv:authTag:ciphertext`
- `isEncrypted()` helper detects encrypted values
- Auto-migration on startup via `server/encryptionMigration.ts`; flag stored in `system_settings.encryption_migrated`

### External Dependencies

**Primary Framework Dependencies**:
- `express` - Web server framework
- `react` & `react-dom` - UI library
- `vite` - Build tool and dev server
- `drizzle-orm` - Database ORM
- `pg` - PostgreSQL client
- `web-push` - Web Push notification delivery (VAPID protocol)
- `node-cron` - Cron job scheduler
- `multer` - File upload (Excel import)
- `xlsx` - Excel parsing and generation

**UI Component Libraries**:
- `@radix-ui/*` - Headless UI primitives (35+ components)
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library
- `recharts` - Charting library for dashboard visualizations

**Form & Validation**:
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `drizzle-zod` - Database schema to Zod validation

**Date Handling**:
- `date-fns` - Date manipulation and formatting

**Database Connection**:
- Connection string from `DATABASE_URL` environment variable
- Connection pooling via `pg.Pool`

---

## Known Naming Conventions

| UI 표시 | DB 필드 | 비고 |
|---------|---------|------|
| 추가정보 | serialNumber | Excel: "추가정보" (구 양식 "시리얼번호" 하위 호환) |
| 추가정보2 | notes | Excel: "추가정보2" |
| 구분 | category | |
| 대상 | asset | |

---

## Recent Changes

### February 2026 - Inspection Cycle Refactor: Months to Days
- Changed inspection cycle from months-based to days-based calculation
- Database column renamed: `inspection_cycle_months` → `inspection_cycle_days`
- Added preset dropdown: 7일, 14일, 30일, 90일, 180일, 365일, 730일, 직접 지정
- Implemented n-1 date calculation with weekend adjustment (Saturday/Sunday → next Monday)
- Updated Excel import/export: column name changed from "점검주기(개월)" to "점검주기(일)", backward compatible

### February 2026 - Equipment Type Registration Workflow & Role Permissions
- Renamed "관리자" tab to "장비 구분" tab
- Added `canAccessTeamPage` permission for both admin and manager roles
- Admin sees both tabs (장비 구분 + 사용자); Manager sees only 사용자 tab
- Login flow: email/password auth (emailAuth.ts)

### February 2026 - Staff User Account Management & Security
- "사용자" tab redesigned for staff accounts (role='staff')
- Added `position` (직책) field to users table
- `hasPassword` boolean derived server-side from passwordHash; passwordHash never exposed in API

### February 2026 - Separated Equipment Types from Manager Users
- Categories table stores equipment types with `managerIds` (text array, supports multiple managers)
- Assets reference both `categoryId` and `managerId`
- Excel export/import aligned with category-based model

### February 2026 - Automated Email Notifications
- Gmail integration via Replit Google Mail connector
- `server/emailService.ts` for HTML email via Gmail API
- `server/scheduler.ts` with node-cron for 9 AM KST daily inspection check
- Scheduler checks assets due within 7 days (inclusive) and overdue assets

### January 2026 - Email/Password Authentication
- Replaced Replit Auth with email/password authentication
- Session management via express-session + connect-pg-simple

### March 2026 - Personal Data Encryption
- AES-256-GCM encryption on `users.username`
- Auto-migration on startup; `encryption_migrated` flag in system_settings

### March 2026 - Asset Excel Upload Upsert
- Import updates existing assets when serial number matches (upsert behavior)
- `ImportResult` includes `updateCount`

### March 2026 - Personal Schedule Management (내 일정)
- New `personal_tasks` DB table
- `/schedule` page with create/edit/delete/complete toggle, filter tabs
- Share scope: `private` (나만 보기) or `selected` (직접 선택 — team + user multi-select)
- Notification rules:
  - Own tasks: 9AM push + email, 10-min-before push
  - Shared tasks: immediate push on creation, 9AM push, 10-min-before push, 6PM digest email
- Scheduler: 3 new cron jobs + midnight flag reset

### March 2026 - PWA Web Push Notifications
- `server/pushService.ts` with web-push library and VAPID keys
- `client/src/components/PushNotificationToggle.tsx` in header
- `client/public/sw.js` service worker for push receipt and display
- `push_subscriptions` DB table

### March 2026 - Category Multiple Managers (`managerIds` array)
- `categories.managerIds` changed from single `managerId` to `managerIds text[]`
- `collectRecipients()` and `collectPushRecipientIds()` include all category managers
- Route order: POST `/api/assets/batch-inspect` before POST `/api/assets/:id/inspect`

### March 2026 - Scheduler Bug Fixes (5 개인일정 + 3 장비알림)
**개인일정 5가지**:
1. 서버 재시작 catch-up에 `checkPersonalTasksMorning()` 추가
2. 푸시+이메일 병행 발송
3. 6PM 다이제스트 catch-up 추가
4. 과거 미발송 일정(morningNotified=false) 처리
5. `getSystemSetting`/`setSystemSetting` 공통 함수화

**장비알림 3가지**:
1. `last_email_date` — 발송 완료 후 기록 (발송 전 기록 시 재시도 불가 버그 수정)
2. `collectRecipients()`에 `category.managerIds[]` 전원 추가 (`collectPushRecipientIds()` 신설)
3. `getAssets()` 조회 시 status 실시간 재계산 (DB 저장값 대신 동적 계산)

### March–April 2026 - 경영공시 알림 버그 수정

**버그 1: 7일 경계값 off-by-one** (2026-03-25 수정)
- `isBefore(dueDate, sevenDaysFromNow)` → `!isAfter(dueDate, sevenDaysFromNow)` 로 변경
- 정확히 7일 후 마감인 자산이 알림에서 누락되던 문제 해결

**버그 2: 이메일 수신자 이름 오류** (2026-04-06 수정)
- 구분관리자에게도 담당자 이름으로 인사말이 발송되던 문제
- `sendInspectionReminder` / `sendOverdueAlert`에 `recipientName?` 파라미터 추가
- 발송 루프에서 `email`로 수신자를 조회하여 각자의 이름으로 인사말 작성
- 담당자 이름은 이메일 본문의 별도 "담당자:" 필드에 표시

**버그 3: 푸시 구독 서버 저장 실패** (2026-04-06 수정)
- `PushNotificationToggle.tsx`: `POST /api/push/subscribe` 응답 결과를 검사하지 않아 서버 저장 실패 시에도 "성공" 표시하던 문제 → 응답 확인 후 실패 시 에러 throw
- `pushService.ts`: 구독 없을 때 / 발송 시도 시 상세 로그 추가

**버그 4: 푸시 구독 user_id = null** (2026-04-06 수정)
- `server/routes.ts` push subscribe 라우트: `const user = getCurrentUser(req)` — `await` 누락
- `getCurrentUser`는 async 함수인데 await 없이 호출 → Promise 객체 반환 → `user.id = undefined` → DB `NOT NULL` 제약 위반
- **수정**: `const user = (req as any).currentUser;` 로 변경 — `requireAuth` 미들웨어가 이미 설정한 값 재사용
