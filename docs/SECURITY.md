# Medora — Security Architecture & Guidelines

## 1. Authentication & Credential Security (Argon2id)
- **Hashing Algorithm [OWNER APPROVED]**: The system uses **Argon2id** (v=19).
- **Proposed Configuration Parameters [PROPOSED]**:
  - Memory cost ($m$): 64 MB (65,536 KiB).
  - Time iterations ($t$): 3 passes.
  - Parallelism ($p$): 1 thread.
  - Salt: 16 bytes (128 bits) of CSPRNG-generated cryptographically secure random bytes.
- **Verification & Re-hashing**:
  - Verification uses `argon2.verify(storedHash, plainPassword)`.
  - Re-hashing check: `argon2.needsRehash(storedHash, currentOptions)` automatically upgrades hashes upon login if cost parameters are raised in the future.
- **Plaintext Ban**: Passwords are never logged, formatted into error messages, or transmitted in unencrypted query parameters.
- **Session Tokens [PROPOSED]**:
  - Access Token: Short-lived (15 minutes), signed via RS256/HS256 with user ID, role, and hospital scope.
  - Refresh Token: Stored as SHA-256 / Argon2 hash in PostgreSQL, rotated on every usage with automatic family revocation upon detected reuse.
  - Instant Session Revocation: `token_invalid_before` timestamp stored on user record invalidates outstanding access tokens during security emergencies.

---

## 2. Authorization & Clinical Privacy Boundaries
- **Strict RBAC Guard**: Every protected endpoint enforces permissions defined in `ROLE_PERMISSION_MATRIX.md`.
- **Receptionist Segregation [OWNER APPROVED]**:
  - Front-desk receptionists are strictly prohibited from viewing consultation notes, diagnoses, prescriptions, and diet charts.
  - Enforcement is implemented at the database query projection level (DTO isolation), ensuring that sensitive clinical fields are never selected from PostgreSQL in receptionist requests.
- **Doctor Assignment Boundaries**:
  - Doctors access patient historical records when the patient has an active appointment with that doctor, is in their department queue, or via an audited clinical referral.
- **Hospital Administrator Audited Access & Authorship Separation [OWNER APPROVED]**:
  - Administrators possess operational oversight authority.
  - Administrative read access to confidential clinical health records triggers an immediate high-priority audit entry (`CLINICAL_RECORD_ADMIN_OVERRIDE`).
  - Administrators **cannot alter or delete** a doctor's finalized consultation notes, and cannot author clinical records. Any administrative note must follow the signed-addendum workflow.

---

## 3. Browser-Based PDF Rendering Security [OWNER APPROVED]
- **HTML Injection Defense**:
  - User-supplied text (patient names, dosages, clinical remarks) is rendered using Handlebars with strict auto-escaping (`{{variable}}`).
  - Raw unescaped strings (`{{{raw}}}`) are strictly prohibited.
- **Headless Browser Hardening [PROPOSED]**:
  - Chromium runs in an isolated sandbox process.
  - Rendering pages load on `about:blank` with content provided via `page.setContent()`.
  - Network access in the headless browser page is completely disabled (`page.setRequestInterception(true)` aborting external HTTP requests) to eliminate Server-Side Request Forgery (SSRF) threats.

---

## 4. Tamper-Evident Audit Logging: Boundaries & Honest Threat Model

### 4.1 Append-Only Database Permissions [OWNER APPROVED]
The application service user in PostgreSQL is explicitly denied mutation privileges on `audit_logs`:
`REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM medora_app_user;`
This prevents compromised application credentials, SQL injection flaws, or rogue application processes from altering or deleting historical audit records.

### 4.2 Cryptographic Hash Chaining [PROPOSED]
Every audit record includes a SHA-256 `record_hash` computed from:
$$\text{record\_hash} = \text{SHA256}(\text{id} + \text{actor\_id} + \text{action} + \text{timestamp} + \text{entity\_id} + \text{payload} + \text{previous\_hash})$$
This allows automated integrity verification routines to detect any unauthorized modification or deletion of historical records within the database table.

### 4.3 Privileged Database Administrator (DBA) Threats & External Anchoring
- **Honest Security Assessment**:
  Hash chaining inside PostgreSQL does **not** provide absolute immutability against a privileged database superuser (`postgres` or DBA) who possesses direct console or root database access. A privileged DBA could modify records and recompute the entire hash chain.
- **Mitigation / External Anchoring Strategy [PROPOSED]**:
  To achieve true non-repudiation:
  1. The latest audit hash is periodically published (e.g. hourly) to an external append-only log server, remote syslog, or WORM (Write Once, Read Many) cloud storage bucket.
  2. Any retrospective tampering within the database creates a hash mismatch against the externally anchored checkpoint, providing definitive evidence of tampering.

---

## 5. Input Validation, SQL Injection & Transport Defense
- **Zod Validation**: All inbound HTTP request payloads (body, query, params) are validated and sanitized via strict Zod schemas before hitting controller logic.
- **Parameterized SQL**: All database operations execute through Prisma ORM parameterized queries. Raw string interpolation in queries is strictly banned.
- **Transport Security**: HTTPS mandatory in all deployed environments. `helmet` enforces Content Security Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options (`DENY`), and X-Content-Type-Options (`nosniff`).
