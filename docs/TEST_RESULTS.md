# Medora — Test Execution Results

## 1. Test Run History

| Date / Timestamp | Phase | Test Suite | Total Tests | Passed | Failed | Skipped | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| 2026-11-12 | Phase 0 | Baseline Initialization | 0 | 0 | 0 | 0 | Initialized (No tests executed yet) |
| 2026-11-20 | MED-004 | Backend Foundation Suite | 10 | 10 | 0 | 0 | PASSED |
| 2026-11-20 | MED-005 | Authentication & Authorization Suite (Durable PostgreSQL Lineage) | 52 | 52 | 0 | 0 | PASSED (Unit & Integration) |

---

## 2. Test Execution Details

### MED-004 Test Execution (2026-11-20)
- **Command**: `npm test` (`jest`)
- **Execution Mode**: Integration & Unit (Supertest + Jest)
- **Suites Executed**:
  1. `src/tests/appError.test.ts` (AppError domain hierarchy and status mapping) - 4 tests passed
  2. `src/tests/error.test.ts` (404 and security headers middleware) - 2 tests passed
  3. `src/tests/health.test.ts` (Health-check endpoints, query validation, and degradation flags) - 4 tests passed
- **Result Summary**:
  ```text
  Test Suites: 3 passed, 3 total
  Tests:       10 passed, 10 total
  Snapshots:   0 total
  Time:        12.632 s
  Ran all test suites.
  ```

### MED-005 Test Execution (2026-11-20 - Durable PostgreSQL Lineage & Concurrency Hardening)
- **Command**: `npm test` (`jest --runInBand`)
- **Execution Mode**: Integration & Unit (Supertest + Jest)
- **Suites Executed**:
  1. `src/tests/appError.test.ts` (Domain AppError hierarchy and HTTP codes) - 4 tests passed
  2. `src/tests/security.test.ts` (Argon2id, AES-256-GCM encryption/decryption, SHA-256 tokens, JWT token operations, Role permissions) - 7 tests passed
  3. `src/tests/authMiddleware.test.ts` (Bearer JWT auth, status checks, live DB sync on status/role/tokenInvalidBefore, RBAC role guard, granular permissions, resource ownership) - 16 tests passed
  4. `src/tests/authEndpoints.test.ts` (Registration, privilege escalation block, login, password complexity, account lockout, atomic durable refresh rotation, multi-instance duplicate handling, server restart recovery, unknown token rejection, expired token rejection, genuine reuse family revocation, logout with/without token, /me) - 15 tests passed
  5. `src/tests/health.test.ts` (Health-check endpoints, database check queries) - 4 tests passed
  6. `src/tests/error.test.ts` (404 and security headers) - 6 tests passed
- **Result Summary**:
  ```text
  Test Suites: 6 passed, 6 total
  Tests:       52 passed, 52 total
  Snapshots:   0 total
  Time:        27.38 s
  Ran all test suites.
  ```

### MED-004 / MED-005 Infrastructure & Database Status
- **Docker Daemon**: Inaccessible / offline (`permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`). Docker containers could not be started.
- **Database Connectivity**: PostgreSQL is currently unreachable at `localhost:5432` (`Error: P1001: Can't reach database server at localhost:5432`). Database integration tests requiring live PostgreSQL connection are marked **BLOCKED**.
- **Prisma Schema Validation**: Valid (`npx prisma validate` succeeded with zero diagnostics).
- **Prisma Client Generation**: Succeeded (v6.19.3) reflecting `familyId`, `revokedAt`, `replacedByTokenId`, and encrypted token storage.
- **Prisma Migrations**: Migration SQL generated at `prisma/migrations/20261120154500_add_refresh_token_lineage/migration.sql`. Migrations remain **UNAPPLIED** because live PostgreSQL is offline. Zero databases were reset or modified.
