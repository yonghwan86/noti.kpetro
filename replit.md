# AI 업무 알림 서비스 (장비관리시스템)

## 프로젝트 개요

장비/자산 점검 이력 추적, 역할별 접근 제어, Gmail API 기반 일일 다이제스트(매일 오전 6시 KST), PWA 웹 푸시 알림, 개인 일정 관리("내 일정")를 제공하는 풀스택 웹 애플리케이션.

- **커스텀 도메인**: `noti.kpetro.or.kr`
- **배포 방식**: Reserved VM (24시간 상시 실행)
- **빌드**: `npm run build` → **실행**: `npm run start`
- **스택**: React + Express + PostgreSQL (Drizzle ORM)

---

## 사용자 환경 설정

- 의사소통 언어: 한국어 (로그·코드 식별자는 영어 유지)

---

## 시스템 아키텍처

### 프론트엔드

**프레임워크**: React 18 + TypeScript, Vite 빌드/개발 서버

**UI 컴포넌트**: shadcn/ui (Radix UI 기반) + Tailwind CSS + "new-york" 스타일 변형, CSS 변수 테마

**상태 관리**:
- TanStack Query (React Query) — 서버 상태 관리 및 API 캐시
  - `staleTime: 0`, `refetchOnWindowFocus: true` (항상 최신 데이터 유지)
- React Context API (`UserContext`) — 현재 사용자, 팀, 사용자 전환
- localStorage — 현재 사용자 선택 세션 유지

**라우팅**: wouter 경량 클라이언트 사이드 라우팅

| 경로 | 페이지 |
|------|--------|
| `/` | 대시보드 (통계 + 차트) |
| `/assets` | 장비 관리 |
| `/schedule` | 내 일정 |
| `/team` | 팀·사용자 관리 |
| `/settings` | 시스템 설정 |
| `/logs` | 점검 이력·감사 로그 |

**폼 처리**: React Hook Form + Zod 스키마 검증

**권한 확인**: 클라이언트(UI 표시용) + 서버(API 보안용) 양쪽 동일하게 적용. 공통 로직은 `server/auth.ts`와 `client/src/lib/auth.ts`에 중앙화.

**경로 별칭**:
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

---

### 백엔드

**프레임워크**: Express.js + TypeScript, Node.js

**API 엔드포인트**:

| 경로 | 설명 |
|------|------|
| `/api/teams` | 팀 CRUD |
| `/api/users` | 사용자 관리 |
| `/api/assets` | 장비 CRUD + 점검 처리 |
| `/api/logs` | 점검 이력·감사 로그 |
| `/api/personal-tasks` | 내 일정 관리 |
| `/api/push/*` | 웹 푸시 구독 관리 |
| `/api/email/*` | 이메일 알림 수동 트리거 |

**인증·세션**:
- 이메일/비밀번호 인증 (`server/emailAuth.ts`) — 어드민이 계정 생성, 최초 로그인 시 비밀번호 설정
- express-session + connect-pg-simple (PostgreSQL 세션 스토어)
- `requireAuth` 미들웨어: `(req as any).currentUser` 에 현재 사용자 저장
- **중요**: `currentUser`는 반드시 `(req as any).currentUser` 로 참조할 것. `getCurrentUser(req)` 를 라우트에서 직접 호출하면 async 함수가 Promise를 반환하므로 `await` 없이 사용 불가.
- 로그아웃 시 `queryClient.clear()` + `window.location.href = "/"` (캐시 완전 초기화)

**역할 체계** (DB `users.role` 3가지):

| 역할 | 권한 |
|------|------|
| `admin` (마스터) | 전체 기능 접근 |
| `manager` (구분 관리자) | 자신의 구분 CRUD + 담당 자산 CRUD + 담당 직원 관리 |
| `staff` (담당자) | 자신의 자산 추가/수정 + 점검 실행 |

**비즈니스 로직**:
- 자산 상태 자동 계산: `ok` / `upcoming` (7일 이내, 포함) / `overdue`
  - `getAssets()` 조회 시 실시간 재계산 (DB 저장값 미사용)
  - 경계값 처리: `!isAfter(dueDate, sevenDaysFromNow)` — 정확히 7일 후도 포함
- 점검 주기: 일(days) 단위, n-1 계산 + 주말 조정 (토·일 → 다음 월요일)
- 날짜 계산: date-fns 라이브러리 사용

**개발 모드**: Vite 미들웨어 + HMR (Hot Module Replacement), Vite 오류 시 프로세스 종료

**프로덕션 빌드**:
- 클라이언트: Vite → `dist/public`
- 서버: esbuild → `dist/index.cjs` (allowlist 방식 번들링으로 cold start 최적화)
- Express가 정적 파일 서빙 담당

---

### 스케줄러 (`server/scheduler.ts`)

**크론 작업** (모두 Asia/Seoul 타임존):

| 크론 | 실행 함수 | 설명 |
|------|----------|------|
| `0 6 * * *` | `sendDailyDigest()` | 통합 다이제스트: 장비 점검 푸시 + 개인일정 푸시 + 이메일 1인 1통 |
| `0 9 * * *` | `checkPersonalTasksMorning()` | 개인일정 9AM 모닝 푸시 (6AM에 미처리된 경우 보완) |
| `* * * * *` | `checkPersonalTasksReminder()` | 개인일정 10분 전 푸시 |
| `0 0 * * *` | 자정 플래그 리셋 | `morningNotified` / `reminderNotified` 초기화 |

**서버 재시작 시 catch-up 로직**:
- kstHour ≥ 6: `sendDailyDigest()` 실행 (멱등성 키 체크로 중복 방지)
- kstHour ≥ 9: `checkPersonalTasksMorning()` 실행

**멱등성 키** (`system_settings` 테이블):
- `last_daily_digest_date` — 당일 발송 완료 여부 (발송 완료 **후** 기록 — 장애 시 재시도 보장)
- ⚠️ 발송 **전**에 기록하면 장애 시 재시도가 불가능하므로 절대 금지

**`sendDailyDigest()` 실행 순서** (순서 준수 필수):
1. ① `sendInspectionPushNotifications(preloaded)` — 장비 점검 푸시 (이메일 없음)
2. ② 개인일정 모닝 푸시 — `morningNotified=false`인 오늘 이전 일정, 공유 대상 포함
3. ③ 이메일 다이제스트 — `collectDailyDigestForUser()` → 내용 있는 사용자만 `sendDailyDigestEmail()` (1인 1통)
4. ④ `morningNotified = true` 설정
5. ⑤ `last_daily_digest_date` 기록 (반드시 마지막)

**`collectDailyDigestForUser(userId, preloaded)` 수집 기준**:
- 장비 점검: `staffId` / `managerId` / `category.managerIds[]` / 팀장 (`position='팀장'` AND 같은 팀)
- 오늘·내일 일정: 본인 + 공유 대상 (`shareScope='selected'` AND `shareUserIds/shareTeamIds` 포함)
- 3개 섹션 모두 비면 `null` 반환 → 이메일 미발송

**참고**: 팀 `contactEmail`은 userId 없는 공유 계정이므로 다이제스트 수신 제외. 장비 점검 알림은 담당자/구분관리자/팀장 개인 이메일로 발송.

---

### 웹 푸시 알림 (`server/pushService.ts`)

- Web Push 프로토콜, VAPID 키 (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env vars)
- `sendPushToUser(userId, title, body, url)` — DB에서 구독 조회, 없으면 로그만 남기고 스킵
- 만료 구독 (HTTP 410/404) 자동 DB 삭제
- `client/src/components/PushNotificationToggle.tsx` — 헤더 내 구독/해제 토글
- 구독 플로우: 권한 요청 → VAPID 키 획득 → `pushManager.subscribe()` → `POST /api/push/subscribe` (응답 실패 시 에러 throw)
- `client/public/sw.js` — 서비스 워커 (푸시 수신 + 표시)

---

### 데이터베이스

**DB**: PostgreSQL + Drizzle ORM (타입 안전 접근)

**스키마** (`shared/schema.ts`):

| 테이블 | 설명 |
|--------|------|
| `teams` | 조직 팀 (부서명 `department` 텍스트 필드 포함, 별도 departments 테이블 없음) |
| `categories` | 장비 구분 (타입 분류). `managerIds text[]` — 다중 관리자 지원. `defaultCycleDays` — 자산 등록 시 자동 입력 |
| `users` | 시스템 사용자. `assignedCategoryIds text[]` — 담당 구분 목록. `username` AES-256-GCM 암호화 (`enc:` 접두어). `position` 직책. `hasPassword` 서버 파생 (passwordHash 미노출) |
| `assets` | 장비 자산. `teamId` (관리 팀), `usageTeamId` (사용 팀), `categoryId`, `managerId`, `staffId`, `inspectionCycleDays`, `lastInspectedDate`, `nextDueDate`, `status` (동적 계산) |
| `inspectionLogs` | 점검 이력 |
| `personal_tasks` | 개인 일정. `shareScope: 'private' \| 'selected'`, `shareTeamIds`, `shareUserIds`, `morningNotified`, `reminderNotified`, `emailDigestSent` |
| `push_subscriptions` | 웹 푸시 구독 (endpoint, p256dh, auth 키, user_id) |
| `system_settings` | key-value 설정 (`last_daily_digest_date`, `last_email_date`, `last_owner_digest_date`, `encryption_migrated`) |
| `sessions` | express-session PostgreSQL 스토어 |

**주요 관계**:
- 자산(asset): 관리 팀 + 사용 팀 두 개 팀 관계
- 자산: 담당자(staff) + 장비관리자(manager) 연결
- UUID PK: PostgreSQL `gen_random_uuid()` 자동 생성
- FK 제약으로 참조 무결성 보장

**스키마 검증**: Drizzle-Zod 연동으로 런타임 검증 스키마 자동 생성

**마이그레이션**: `npm run db:push` (또는 `npm run db:push --force`)

---

### 암호화

- AES-256-GCM 방식, `users.username` 필드 적용
- `server/encryption.ts`: `encryptText()` / `decryptText()` — `ENCRYPTION_KEY` env var 사용
- 암호화 값 형식: `enc:iv:authTag:ciphertext`
- `isEncrypted()` 헬퍼로 암호화 여부 판별
- 서버 시작 시 자동 마이그레이션 (`server/encryptionMigration.ts`), 완료 플래그: `system_settings.encryption_migrated`

---

## 네이밍 규칙

| UI 표시 | DB 필드 | 비고 |
|---------|---------|------|
| 추가정보 | `serialNumber` | Excel: "추가정보" (구 양식 "시리얼번호" 하위 호환) |
| 추가정보2 | `notes` | Excel: "추가정보2" |
| 구분 | `category` | 장비 타입 분류 |
| 대상 | `asset` | 장비 자산 |

---

## 주요 외부 의존성

| 패키지 | 용도 |
|--------|------|
| `express` | 웹 서버 프레임워크 |
| `react`, `react-dom` | UI 라이브러리 |
| `vite` | 빌드 툴 + 개발 서버 |
| `drizzle-orm` | 데이터베이스 ORM |
| `pg` | PostgreSQL 클라이언트 |
| `web-push` | 웹 푸시 알림 (VAPID 프로토콜) |
| `node-cron` | 크론 잡 스케줄러 |
| `multer` | 파일 업로드 (Excel 가져오기) |
| `xlsx` | Excel 파싱·생성 |
| `@radix-ui/*` | 헤드리스 UI 프리미티브 (35개 이상) |
| `tailwindcss` | 유틸리티 CSS 프레임워크 |
| `lucide-react` | 아이콘 라이브러리 |
| `recharts` | 대시보드 차트 |
| `react-hook-form` | 폼 상태 관리 |
| `zod`, `drizzle-zod` | 스키마 검증 |
| `date-fns` | 날짜 계산 |

**Replit 통합**:
- `javascript_log_in_with_replit` (v2.0.0) — 설치됨
- `google-mail` (v1.0.0) — Gmail API 이메일 발송

---

## 변경 이력

### 2026년 1월 — 이메일/비밀번호 인증 전환
- Replit Auth → 이메일/비밀번호 인증으로 교체
- express-session + connect-pg-simple 세션 관리

### 2026년 2월 — 점검 주기 개월→일 전환
- DB 컬럼명: `inspection_cycle_months` → `inspection_cycle_days`
- 프리셋: 7·14·30·90·180·365·730일 + 직접 지정
- n-1 계산 + 주말 조정 (토·일 → 다음 월요일)
- Excel: "점검주기(개월)" → "점검주기(일)" (하위 호환 유지)

### 2026년 2월 — 장비 구분 탭 및 역할 권한 개편
- "관리자" 탭 → "장비 구분" 탭 이름 변경
- `canAccessTeamPage` 권한: admin + manager 모두 허용
- Admin: 장비 구분 + 사용자 탭 모두 표시 / Manager: 사용자 탭만

### 2026년 2월 — 사용자 계정 관리 + 직책 필드
- 사용자 탭 `staff` 계정 전용으로 재설계
- `position` (직책) 필드 추가
- `hasPassword` — 서버 파생값, `passwordHash` API 미노출

### 2026년 2월 — 구분 복수 관리자 분리
- `categories.managerIds text[]` — 단일 → 복수 관리자 지원
- 자산에 `categoryId` + `managerId` 분리 참조

### 2026년 2월 — 이메일 알림 자동화
- Gmail API 연동 (`server/emailService.ts`)
- node-cron 스케줄러 (`server/scheduler.ts`)
- 7일 이내 + 만기 자산 매일 점검

### 2026년 3월 — 개인 정보 암호화
- `users.username` AES-256-GCM 암호화
- 서버 시작 시 자동 마이그레이션

### 2026년 3월 — Excel 업로드 Upsert
- 시리얼번호 일치 시 업데이트 (upsert)
- `ImportResult`에 `updateCount` 포함

### 2026년 3월 — 개인 일정 관리 (내 일정)
- `personal_tasks` 테이블 신설
- `/schedule` 페이지: 생성/수정/삭제/완료 토글, 필터 탭
- 공유 범위: `private` (나만 보기) / `selected` (팀·사용자 선택)
- 알림 규칙: 본인 일정(9AM 푸시+이메일, 10분 전 푸시) / 공유 일정(생성 즉시 푸시 + 동일 규칙)
- 크론 3개 추가 + 자정 플래그 리셋

### 2026년 3월 — PWA 웹 푸시 알림
- `server/pushService.ts` + web-push 라이브러리 + VAPID 키
- `client/src/components/PushNotificationToggle.tsx` 헤더 토글
- `client/public/sw.js` 서비스 워커
- `push_subscriptions` 테이블

### 2026년 3월 — 구분 복수 관리자 (`managerIds` 배열)
- `collectRecipients()` + `collectPushRecipientIds()` 전원 포함
- 라우트 순서: `POST /api/assets/batch-inspect` → `POST /api/assets/:id/inspect` 순

### 2026년 3월 — 스케줄러 버그 수정 (개인일정 5건 + 장비알림 3건)
**개인일정**:
1. 서버 재시작 catch-up에 `checkPersonalTasksMorning()` 추가
2. 푸시 + 이메일 병행 발송
3. 6PM 다이제스트 catch-up 추가
4. 과거 미발송 일정(`morningNotified=false`) 처리
5. `getSystemSetting` / `setSystemSetting` 공통 함수화

**장비알림**:
1. `last_email_date` — 발송 완료 **후** 기록 (발송 전 기록 시 재시도 불가 버그 수정)
2. `collectRecipients()`에 `category.managerIds[]` 전원 추가
3. `getAssets()` 실시간 status 재계산 (DB 저장값 대신 동적 계산)

### 2026년 3~4월 — 알림 버그 4건 수정

**버그 1: 7일 경계값 off-by-one** (2026-03-25)
- `isBefore(dueDate, sevenDaysFromNow)` → `!isAfter(dueDate, sevenDaysFromNow)`
- 정확히 7일 후 마감 자산이 알림 누락되던 문제 해결

**버그 2: 이메일 수신자 이름 오류** (2026-04-06)
- 구분관리자에게 담당자 이름으로 인사말 발송되던 문제
- `sendInspectionReminder` / `sendOverdueAlert`에 `recipientName?` 파라미터 추가
- 발송 루프에서 이메일로 수신자 조회 후 개인 이름으로 발송

**버그 3: 푸시 구독 서버 저장 실패 무시** (2026-04-06)
- `PushNotificationToggle.tsx`: `POST /api/push/subscribe` 응답 미검사 → 실패 시에도 성공 표시 버그
- 응답 확인 후 실패 시 에러 throw로 수정

**버그 4: 푸시 구독 `user_id = null`** (2026-04-06)
- 라우트에서 `getCurrentUser(req)` 를 `await` 없이 호출 → Promise 반환 → `user.id = undefined` → DB NOT NULL 위반
- `(req as any).currentUser` 로 변경 (requireAuth 미들웨어 설정값 재사용)

### 2026년 4월 — 통합 다이제스트 + 스케줄러 일원화
- 별도로 운영되던 장비 알림 + 개인일정 + 이메일을 `sendDailyDigest()` 1개 함수로 통합
- 이메일: 1인 1통 (섹션 3개 — 장비 점검, 오늘 일정, 내일 일정)
- 기존 `last_email_date`, `last_owner_digest_date` → `last_daily_digest_date` 로 대체

### 2026년 4월 — React Query 캐시 설정 강화
- `staleTime: 0`, `refetchOnWindowFocus: true` 전역 적용
- 로그아웃 시 `queryClient.clear()` + `window.location.href = "/"` (캐시 완전 초기화, 사용자 간 데이터 누출 방지)
- `main.tsx`에서 별도 QueryClient 생성 제거 → `queryClient.ts` 공유 인스턴스로 일원화

### 2026년 4월 — PWA 안드로이드/iOS 설치 및 푸시 수신 개선
- `client/public/sw.js`에 `fetch` 이벤트 핸들러 추가 (Network-First 전략, 캐시 폴백)
  - `/api/` 경로는 항상 네트워크 우선, 정적 자산만 캐시
  - 삼성 인터넷 "Unsafe app blocked" 오류 해결 (fetch 핸들러 없으면 유효한 PWA로 미인식)
  - Cache 이름: `noti-app-v1`, activate 시 구버전 캐시 자동 정리
- `activate` 핸들러 개선: 구버전 캐시 키 삭제 후 `clients.claim()`
- iOS 16.4+ Safari 홈 화면 추가 후 Web Push 정상 동작 (manifest `display: standalone` + iOS 메타태그 기존 유지)
