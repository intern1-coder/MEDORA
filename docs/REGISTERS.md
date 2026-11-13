# Medora — Engineering Registers

## 1. Requirements Traceability Matrix (RTM)

### 1.1 Requirements Status Categories
- **OWNER APPROVED**: Formally reviewed and confirmed by the project owner.
- **PROPOSED**: Recommended by engineering; awaiting formal owner sign-off.
- **IMPLEMENTED**: Fully coded in application source code and verified with passing automated tests.
- **UNRESOLVED**: Requires owner decision, domain clarification, or additional investigation.

---

### 1.2 Traceability Ledger

| Req ID | Requirement Description | Module | Priority | Related Business Rules | Role & Access Implications | Planned Test Method | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **REQ-AUTH-001** | Argon2id password hashing with salts | Auth | High | BR-AUTH-001, BR-AUTH-002 | All roles (authentication) | Unit & Security Test | OWNER APPROVED |
| **REQ-AUTH-002** | JWT access & rotating refresh tokens | Auth | High | BR-AUTH-003 | All authenticated roles | Integration Test | PROPOSED |
| **REQ-AUTH-003** | Granular RBAC permission enforcement | Auth | High | ROLE_PERMISSION_MATRIX | 4 Approved Roles (`PATIENT`, `DOCTOR`, `RECEPTIONIST`, `HOSPITAL_ADMIN`) | Security Integration Test | OWNER APPROVED |
| **REQ-AUTH-004** | Immediate token & session revocation | Auth | High | BR-AUTH-003 | User self, Hospital Admin | Integration Test | PROPOSED |
| **REQ-HOSP-001** | Department CRUD & room allocations | Hospital | High | BR-HOSP-001 | Hospital Admin | Integration Test | OWNER APPROVED |
| **REQ-HOSP-002** | Doctor multi-department association | Hospital | High | BR-HOSP-002 | Hospital Admin, Doctor | Integration Test | OWNER APPROVED |
| **REQ-DOCT-001** | Doctor profile, license & fee setup | Doctor | High | BR-DOCT-001 | Doctor (own), Hospital Admin | Integration Test | OWNER APPROVED |
| **REQ-DOCT-002** | Weekly availability & leave booking | Doctor | High | BR-DOCT-002 | Doctor (own), Hospital Admin | Unit & Integration Test | OWNER APPROVED |
| **REQ-DOCT-004** | Doctor's own consultation history access| Doctor | High | BR-ACCESS-2.1 | Doctor (self-authored) | Security Test | OWNER APPROVED |
| **REQ-DOCT-005** | Other doctors' consultation access rule | Doctor | High | BR-ACCESS-2.2 | Treating Doctor (active care/referral, audited)| Security Test | OWNER APPROVED |
| **REQ-PAT-001** | MRN format `MED-YYYY-XXXXX` | Patient | Critical| BR-PAT-001 | Receptionist, Hospital Admin | Concurrency Test | OWNER APPROVED |
| **REQ-PAT-001A**| MRN annual reset policy (DEC-004A) | Patient | Medium | BR-PAT-003 | Receptionist, Hospital Admin | Concurrency Test | UNRESOLVED |
| **REQ-PAT-001B**| MRN 5-digit overflow policy (DEC-004B)| Patient | Medium | BR-PAT-004 | Receptionist, Hospital Admin | Concurrency Test | UNRESOLVED |
| **REQ-PAT-002** | Patient demographics, allergies & history| Patient | High | BR-PAT-002 | Receptionist (demographics), Doctor | Integration Test | OWNER APPROVED |
| **REQ-PAT-005** | Patient permitted history access | Patient | High | BR-ACCESS-2.3 | Patient (own finalized records) | Security Test | OWNER APPROVED |
| **REQ-APPT-001** | Slot reservation with overlap exclusion | Appointment| Critical| BR-APPT-001 to 004 | Patient, Receptionist, Doctor | Concurrency Stress Test | OWNER APPROVED |
| **REQ-APPT-002** | Appointment status lifecycle | Appointment| High | BR-APPT-003 | Receptionist, Doctor, Patient | State Machine Test | OWNER APPROVED |
| **REQ-QUEUE-001** | Appointment-aware queue with walk-ins | Queue | High | BR-QUEUE-5.1 | Receptionist (issue), Doctor | Unit & Integration Test | OWNER APPROVED |
| **REQ-QUEUE-002** | Doctor-only clinical urgency priority | Queue | High | BR-QUEUE-5.1 | Doctor only (audited) | Security Test | OWNER APPROVED |
| **REQ-QUEUE-004** | Hierarchical 5-tier queue model | Queue | Medium | BR-QUEUE-5.2 | Queue Engine | Unit Test | PROPOSED |
| **REQ-CONS-001** | Mandatory consultation lifecycle order | Consultation | Critical| BR-CONS-6.1 | Doctor | State Machine Test | OWNER APPROVED |
| **REQ-CONS-002** | Consultation finalization & locking | Consultation | Critical| BR-CONS-6.1 | Assigned Doctor only | Immutability Test | OWNER APPROVED |
| **REQ-CONS-003** | Signed consultation addenda | Consultation | High | BR-CONS-6.1 | Authoring Doctor only | Integration Test | OWNER APPROVED |
| **REQ-CONS-004** | Hospital Admin audited clinical read | Consultation | High | BR-CONS-6.2 | Hospital Admin (audited read) | Security Integration Test | OWNER APPROVED |
| **REQ-PRES-001** | 10-attribute structured prescription | Prescription | High | BR-PRES-7.1 | Consulting Doctor only | Validation & Unit Test | OWNER APPROVED |
| **REQ-PRES-004** | Prescription amendment & discontinuation | Prescription | High | BR-PRES-7.2 | Consulting Doctor only | Security Test | PROPOSED |
| **REQ-DIET-001** | Optional doctor-controlled diet plans | Diet | Medium | BR-DIET-001 to 005 | Doctor (author), Patient (view) | Integration Test | OWNER APPROVED |
| **REQ-REP-001** | Browser-based PDF reports & receipts | Reports | High | ADR-003 | Doctor, Patient, Receptionist (receipts)| Visual & Integration Test | OWNER APPROVED |
| **REQ-REP-002** | PDF Chromium container deployment model| Reports | High | ADR-003 | PDF Service | Deployment Test | UNRESOLVED |
| **REQ-DOC-001** | Medical document & scan tracking | Documents | Medium | ADR-005 | Doctor, Patient (own), Admin | Integration Test | OWNER APPROVED |
| **REQ-BILL-001** | Itemized invoicing & multi-tender pay | Billing | High | BR-BILL-001 to 003 | Receptionist, Admin, Patient | Integration Test | OWNER APPROVED |
| **REQ-BILL-002** | Receptionist demographic vs clinical isolation | Billing | Critical| BR-BILL-004, ROLE_PERMISSION | Receptionist (denied clinical) | API Projection Security Test | OWNER APPROVED |
| **REQ-AUD-001** | Append-only security audit logging | Audit | Critical| SECURITY | Hospital Admin (read), System (append) | Security Permission Test | OWNER APPROVED |
| **REQ-AUD-002** | Cryptographic hash chaining in audit logs | Audit | High | SECURITY | Audit Engine | Tamper Detection Test | PROPOSED |

---

## 2. Decision Ledger

| Decision ID | Decision Topic | Status | Detailed Description | Reference |
| :--- | :--- | :---: | :--- | :--- |
| **DEC-001** | Git Initialization & Working Branch | **IMPLEMENTED** | Local repository initialized on branch `develop` with comprehensive `.gitignore`. Zero commits created. | `git status`, `.gitignore` |
| **DEC-002** | Password Hashing Algorithm | **OWNER APPROVED** | Algorithm approved as Argon2id. Specific parameters (64 MB, 3 passes, 16-byte salt) and password reset token lifespan (15m) are **PROPOSED**. Runtime implementation: **NOT IMPLEMENTED**. | [ADR-002](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/decisions/ADR-002.md) |
| **DEC-003** | PDF Generation Strategy | **OWNER APPROVED** | Browser-based PDF generation via HTML templates approved. Specific engine (Puppeteer-Core), template tool (Handlebars), and container deployment (Embedded vs Sidecar) are **PROPOSED / UNRESOLVED**. Runtime implementation: **NOT IMPLEMENTED**. | [ADR-003](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/decisions/ADR-003.md) |
| **DEC-004** | Patient MRN Visible Format | **OWNER APPROVED** | Format approved as `MED-YYYY-XXXXX`. Annual sequence reset policy (DEC-004A) and 5-digit limit overflow behavior (DEC-004B) are **UNRESOLVED / PROPOSED**. Runtime implementation: **NOT IMPLEMENTED**. | [ADR-004](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/decisions/ADR-004.md) |
| **DEC-005** | Consultation Immutability & Addenda | **OWNER APPROVED** | Locked permanently upon finalization; modifications recorded via signed addenda; mandatory lifecycle order confirmed. Runtime implementation: **NOT IMPLEMENTED**. | [ADR-005](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/decisions/ADR-005.md) |
| **DEC-006** | Appointment-Aware Queue & Urgency | **OWNER APPROVED** | Appointment-aware queue and clinical urgency elevation approved. Hierarchical 5-tier queue model proposed (numerical weights removed). Urgency assignment restricted to `DOCTOR`. Runtime implementation: **NOT IMPLEMENTED**. | [ADR-006](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/decisions/ADR-006.md) |

---

## 3. Unresolved Decisions Awaiting Project Owner Confirmation (Timing & Impact Classification)

| Decision ID | Topic | Options for Owner Review | Timing Classification | Engineering Recommendation | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **DEC-004A** | MRN Annual Reset Policy | 1. Reset sequence to `00001` at midnight local hospital timezone on Jan 1st.<br>2. Continuous sequence across years (`MED-2026-00001`, `MED-2027-00450`). | **Can safely remain open until Phase 5** (Patient registration service implementation). Schema already stores `year` in sequence table. | Option 1 (Reset annually at local midnight) to keep sequence organized by annual cohort. | **Awaiting Decision** |
| **DEC-004B** | MRN 5-Digit Limit Overflow Handling | 1. Enforce strict 5-digit cap (max 99,999) with administrative alert at 90,000.<br>2. Permit dynamic sequence expansion beyond 5 digits (`MED-YYYY-100000`). | **Can safely remain open until Phase 5** (Patient registration service). `Patient.mrn` is sized `VARCHAR(32)` to accommodate either choice without schema changes. | Option 2 (Dynamic expansion) prevents patient intake blockage during unexpected volume surge. | **Awaiting Decision** |
| **DEC-007** | Future Clinical Triage Role Governance | 1. Introduce dedicated `TRIAGE_NURSE` role in a later phase.<br>2. Keep urgency assignment permanently assigned to `DOCTOR` only. | **Can safely remain open until Phase 6** (Queue management). Current schema restricts urgency assignment to approved `User` (filtered to `DOCTOR` in application layer). | Option 1: Evaluate `TRIAGE_NURSE` in Phase 6 to prevent doctor intake bottlenecks in busy OPDs. | **Awaiting Decision** |
| **DEC-009** | PDF Headless Chromium Container Deployment | 1. Embedded Chromium inside backend container.<br>2. Dedicated standalone sidecar microservice container. | **Can safely remain open until Phase 8** (Prescription & Report PDF service). Does not affect database schema or foundation setup. | Option 1 for Phase 3 development simplicity; evaluate sidecar container for production. | **Awaiting Decision** |
| **DEC-010** | Technical SUPER_ADMIN Application Role | 1. Do not introduce `SUPER_ADMIN` application role; manage infrastructure externally.<br>2. Create a restricted technical `SUPER_ADMIN` role for multi-hospital maintenance. | **Must be decided before Phase 4** (Authentication & Authorisation). Does NOT block Phase 3 (Foundation Setup). | Option 1: Adhere strictly to the 4 approved application roles. | **Awaiting Decision** |

---

## 4. Known Issues Register

| Issue ID | Date Opened | Severity | Description | Mitigation / Status |
| :--- | :--- | :---: | :--- | :--- |
| **ISSUE-001** | 2026-11-12 | Low | Docker config access warning (`open C:\Users\Darshan\.docker\config.json: Access is denied`) during CLI check | Non-fatal CLI warning; Docker Engine `29.8.0` is operational. To verify compose execution during Phase 3. |
| **ISSUE-002** | 2026-11-13 | Low | Prisma CLI not installed on host environment | Verified by running `prisma -v` (not found). Per restrictions, packages are not installed until Phase 3 foundation setup. |
| **ISSUE-003** | 2026-11-13 | Low | Prisma schema lacks native support for PostgreSQL exclusion constraints | Documented in `DATABASE_DESIGN.md`: exclusion constraints (`btree_gist`) will be deployed via raw SQL migration in Phase 3. |

---

## 5. Development Progress Tracker

- **Active Task**: TASK MED-003C (Final Database Design Clarifications and Evidence Review)
- **Active Phase**: Phase 2 (Database Design & Relationship Review) — CLARIFIED & AUDITED
- **Next Phase**: Phase 3 (Backend Foundation Setup) — Awaiting Owner Approval
- **Application Code Status**: **ZERO application code written, ZERO packages installed, ZERO database migrations run.**
- **Current Milestone**: Full database design audit completed; enforcement layers classified; MED-003B claims reconciled; unresolved decision timeline established; ready for Phase 3 foundation setup upon owner approval.
