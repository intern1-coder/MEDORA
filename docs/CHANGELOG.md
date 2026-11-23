# Medora — Engineering Changelog

All notable changes to the Medora project will be documented in this file in reverse chronological order.

## [Unreleased] - 2026-11-20
### Task MED-005: Authentication and Authorization
- **Authentication Implementation**:
  - Implemented Argon2id password hashing and verification conforming to OWASP parameters (64 MB, 3 passes, 1 thread) with `needsRehash` detection.
  - Implemented JWT access token generation and verification (`HS256`, 15-minute expiration) carrying user ID, role, and account status with live DB state sync.
  - Built durable database-backed refresh token rotation:
    - Added `familyId`, `revokedAt`, `replacedByTokenId`, and AES-256-GCM authenticated encryption for replacement tokens.
    - Completely eliminated in-memory cache maps to ensure full resilience across server restarts and clustered instances.
    - Atomic rotation claiming via `updateMany({ where: { tokenHash, isRevoked: false }, data: { isRevoked: true, revokedAt } })`.
    - Idempotent recovery for legitimate concurrent requests within a 15-second grace window without global session revocation.
    - Session-family revocation isolation (`familyId`) upon genuine reuse outside the grace window.
  - Added user lockout mechanism (locks account for 15 minutes after 5 consecutive failed login attempts).
  - Added emergency global session invalidation (`tokenInvalidBefore`) and individual token logout.
  - Implemented endpoints in `/api/v1/auth`: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`.
- **Authorization & RBAC**:
  - Built RBAC middleware enforcing strictly the four approved roles: `HOSPITAL_ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT`.
  - Defined granular permission mapping in `src/constants/roles.ts` directly adhering to `docs/ROLE_PERMISSION_MATRIX.md`.
  - Created `authorizeRoles`, `authorizePermission`, and `authorizeOwnerOrAdmin` route middlewares.
  - Receptionists strictly denied clinical access and urgency assignments.
  - Separation of administration from clinical authorship enforced.
- **Testing & Tooling**:
  - Installed `jsonwebtoken` and `@types/jsonwebtoken`.
  - Added comprehensive test suites: `security.test.ts`, `authMiddleware.test.ts`, and `authEndpoints.test.ts`.
  - Verified test suite: 6/6 test suites passed, 43/43 tests passed.
  - Full TypeScript compilation clean build (`npm run build`) passing with zero diagnostics.
  - Note: Live database integration and migrations remain blocked due to Docker daemon inaccessibility.

### Task MED-004: Complete Backend Foundation
- **Backend Architecture & Express 5**:
  - Implemented modular layered architecture: `config/`, `constants/`, `controllers/`, `errors/`, `middlewares/`, `routes/`, `services/`, `types/`, `utils/`, `validators/`.
  - Built Express 5 application factory `createApp()` with graceful shutdown handling in `server.ts`.
- **Environment & Configuration**:
  - Added `.env.example` and Zod-validated configuration parser in `src/config/env.ts`.
  - Configured structured JSON logging foundation in `src/config/logger.ts`.
  - Configured singleton PrismaClient with connection health-check utility in `src/config/database.ts`.
- **Security & Error Handling**:
  - Created domain error hierarchy extending `AppError` with custom status codes and operational error tracking.
  - Implemented centralized error handler and catch-all 404 handler returning uniform JSON envelopes (`ApiResponseEnvelope`, `ApiErrorEnvelope`).
  - Added security headers middleware (CSP, nosniff, DENY frame options, referrer policy, CORS).
- **Validation**:
  - Created Zod validation middleware handling body, query, and params seamlessly with Express 5 query getter semantics.
- **Health Check API**:
  - Implemented `/health` and `/api/v1/health` with query validation (`?checkDb=true/false`) and uptime/version tracking.
- **Docker & Infrastructure**:
  - Added multi-stage production-ready `Dockerfile` based on `node:20-alpine`.
  - Added `docker-compose.yml` defining PostgreSQL 16 Alpine with volume persistence and healthcheck.
  - Added `.dockerignore`.
  - Note: Docker daemon was unreachable during local audit; database migrations remain unexecuted until PostgreSQL service is started.
- **Testing & Tooling**:
  - Validated `prisma/schema.prisma` and generated Prisma Client 6.19.3.
  - Created test suite with Jest and Supertest covering error hierarchy, 404 handling, security headers, and health-check API (10 tests, 10 passing).
  - Verified full TypeScript compilation (`tsc`) clean build with zero diagnostics.

## [Unreleased] - 2026-11-13
### Task MED-003C: Final Database Design Clarifications and Evidence Review
- **Enforcement Layer Classification**:
  - Audited all critical business rules and classified their true enforcement mechanisms across (1) Database constraints, (2) Custom SQL migrations, (3) Application/service logic, (4) Planned but not implemented, and (5) Not yet verified.
- **Clarification of Design Assertions**:
  - Reconciled MED-003B claims: clarified that UUIDs provide ID unpredictability but zero authorization on their own; role enums provide schema-level typing but zero endpoint RBAC; consultation locking requires service guards and database triggers; and receptionist isolation is an architectural query requirement, not a database-enforced row isolation.
  - Reconciled query indexing rationale for `QueueToken.urgencyAssignedById`, `PrescriptionItem.supersededByItemId`, and `MedicalDocument.uploadedByUserId`.
  - Clarified 1:1 consultation-to-prescription and diet-plan cardinality vs proposed multi-prescription clinical workflows.
  - Documented lab document metadata vs structured lab observations.
  - Classified all 5 unresolved decisions by development timing and necessity.
- **Documentation Updated**:
  - `docs/REGISTERS.md`
  - `docs/CHANGELOG.md`

### Task MED-003B: Database Schema Review, Validation Planning and Developer Knowledge Transfer
- Inspected draft schema, added 3 performance indexes, and provided developer mentorship walkthrough.

### Task MED-003: Database Architecture, ER Diagram and Prisma Schema Design (Phase 2)
- Authored initial draft `prisma/schema.prisma` with 25 models and 20 enums.
- Created `docs/ER_DIAGRAM.md` with full Mermaid visualization.

### Task MED-002B: Final Permission, Queue and Data Policy Clarification
- Locked application roles strictly to four (`PATIENT`, `DOCTOR`, `RECEPTIONIST`, `HOSPITAL_ADMIN`).
- Codified 3 distinct doctor and patient consultation history access boundaries.

### Task MED-002A: Documentation Accuracy and Business Rule Reconciliation
- Reconciled mandatory consultation lifecycle order across design files.
- Standardized four status tiers (`OWNER APPROVED`, `PROPOSED`, `IMPLEMENTED`, `UNRESOLVED`).

### Task MED-002: Requirements Finalisation, Architecture Review and Approved Decisions
- Initialized local Git repository on `develop` branch with `.gitignore`.
- Drafted ADR-002 through ADR-006.

### Task MED-001: Workspace Audit and Backend Planning
- Initialized workspace audit, verified tooling (`node`, `npm`, `psql`, `docker`), generated requirements baseline.

### Phase 0 Baseline: Workspace Inspection & Project Baseline
- Created initial documentation suite under `docs/`.
