# Medora — Test Strategy

## 1. Testing Philosophy
- **Zero Unverified Claims**: Never report tests as passing without executing the test runner and capturing exact counts.
- **Continuous Verification**: Tests are implemented in tandem with feature code for every development phase.
- **Isolated State**: Tests must execute against an isolated test environment (or test DB instance), with deterministic teardown and fixtures.

## 2. Test Pyramid
1. **Unit Tests (Jest)**:
   - Validate pure business logic, calculations, date/slot generation algorithms, token queuing logic, and password hashing.
   - Fast, deterministic, zero external I/O.
2. **Integration Tests (Supertest + Jest)**:
   - Validate full HTTP request-response cycles through Express routes, middleware, Zod validation, and Prisma database persistence.
   - Validate RBAC enforcement: verify allowed roles succeed (200/201) and unpermitted roles receive 403 Forbidden.
3. **Negative & Edge Case Tests**:
   - Malformed payloads, missing headers, duplicate keys, overlapping appointment slots, invalid state transitions.

## 3. Test Execution Standard
- Command: `npm test` or `npx jest --verbose --runInBand`
- Coverage Target: >= 85% branch coverage on service and validation logic.
