# Medora — System Architecture Specification

## 1. Architectural Style & Clean Layered Design
Medora Backend is designed using a **Clean Layered Architecture** with strict separation of concerns, high cohesion, and low coupling.

```
                    ┌────────────────────────────────────────┐
                    │          HTTP Client / Browser         │
                    └───────────────────┬────────────────────┘
                                        │ (HTTPS / JSON)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │      Routing Layer (Express Router)    │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │           Middleware Layer             │
                    │   - Rate Limiting & Helmet Security    │
                    │   - Authentication (JWT verification)  │
                    │   - RBAC Permission Enforcement Guard  │
                    │   - Zod Input Validation & Sanitization│
                    │   - Audit & Performance Interceptors   │
                    └───────────────────┬────────────────────┘
                                        │ (Validated DTOs)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │           Controller Layer             │
                    │   - HTTP Request / Response Handlers   │
                    │   - Status Code Translation            │
                    │   - Uniform Envelope Packaging         │
                    └───────────────────┬────────────────────┘
                                        │ (Domain Request Objects)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │             Service Layer              │
                    │   - Core Business Logic & Invariants   │
                    │   - Hierarchical Queue Evaluation      │
                    │   - Database Transactions (Prisma $tx) │
                    │   - PDF Generation & Templating        │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │          Data Access / Prisma          │
                    │   - Type-safe Query Generation         │
                    │   - PostgreSQL Database Engine         │
                    └────────────────────────────────────────┘
```

---

## 2. Directory Layout & Module Boundaries

```text
src/
├── config/             # Environment variables, database client, logger, and JWT config
├── constants/          # Application enums, status codes, error codes, role definitions
├── controllers/        # HTTP controllers (request parsing, response envelope packaging)
├── errors/             # Domain error hierarchy (AppError, UnauthorizedError, ForbiddenError, ConflictError)
├── middlewares/        # Express middlewares (auth, rbac, validation, audit, error handler)
├── routes/             # Route declarations grouped by domain module (/api/v1/...)
├── services/           # Pure business logic and transactions (No HTTP dependencies)
├── templates/          # HTML/Handlebars templates for browser-based PDF generation
├── validators/         # Zod schemas for request body, query, and params
├── utils/              # Cryptographic helpers, Argon2id hasher, date-time utilities
├── app.ts              # Express application assembly and middleware binding
└── server.ts           # Server bootstrap and graceful shutdown handler
```

---

## 3. Architecture & Security Review (Detailed Technical Designs)

### 3.1 Doctor Consultation History & Access Separation
- **A. Doctor's Own Consultation History [OWNER APPROVED]**:
  - A doctor has full access to the complete history of consultation records they personally authored.
  - The query layer automatically applies a doctor scope filter when querying self-authored records: `where: { doctorId: req.user.doctorId }`.
- **B. Other Doctors' Consultations [OWNER APPROVED]**:
  - A doctor cannot freely browse or inspect consultation records authored by other doctors.
  - Access is permitted **only** when an authorized care relationship exists:
    1. The patient has an active appointment with the reviewing doctor, OR
    2. The patient is checked into the reviewing doctor's active queue, OR
    3. An explicit clinical referral or consultation transfer record exists.
  - All cross-doctor lookups trigger an immediate audit log entry.
- **C. Patient Permitted History [OWNER APPROVED]**:
  - Patients can access, view, and download only their own finalized consultation summaries, prescriptions, diet plans, documents, and billing receipts. Patients cannot view in-progress consultation drafts or confidential doctor remarks.
  - Authorized treating doctors can access the relevant clinical medical history (past diagnoses, recorded allergies, active prescriptions) of patients currently under their active care.

### 3.2 Hierarchical Queue Evaluation Model [PROPOSED]
The queue engine replaces arbitrary numerical weights with a structured 5-tier evaluation policy:
1. **Tier 1 (Authorized Clinical Urgency)**: Tokens flagged as `EMERGENCY` or `URGENT` by a licensed `DOCTOR` take immediate precedence.
2. **Tier 2 (Appointment-Window Handling)**: Scheduled patients who arrive and check in within their 15-minute slot window are called during their designated time window.
3. **Tier 3 (Waiting-Time Fairness)**: Within the same tier, earlier check-in times take precedence to ensure equity.
4. **Tier 4 (Walk-in Handling)**: Standard walk-in patients are called during schedule buffers and gaps between scheduled appointments.
5. **Tier 5 (Missed-Call & Requeue Handling)**: Tokens called but not reporting within 3 calls or 10 minutes transition to `MISSED`. When re-queued, they are placed behind currently waiting patients.

### 3.3 Appointment Slot Overlap Protection (Doctor & Patient Overlap)
- **Technical Design**:
  - Every appointment record stores both `slot_start` (`TIMESTAMPTZ`) and `slot_end` (`TIMESTAMPTZ`) in UTC.
  - Two appointments overlap if:
    $$\text{SlotA.start} < \text{SlotB.end} \quad \text{AND} \quad \text{SlotA.end} > \text{SlotB.start}$$
  - **Database-Level Exclusion Constraints (PostgreSQL `btree_gist`)**:
    ```sql
    -- 1. Prevent overlapping appointments for the same doctor
    ALTER TABLE appointments
    ADD CONSTRAINT prevent_doctor_slot_overlap
    EXCLUDE USING gist (
        doctor_id WITH =,
        tstzrange(slot_start, slot_end) WITH &&
    ) WHERE (status IN ('SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'));

    -- 2. Prevent overlapping appointments for the same patient across different doctors
    ALTER TABLE appointments
    ADD CONSTRAINT prevent_patient_slot_overlap
    EXCLUDE USING gist (
        patient_id WITH =,
        tstzrange(slot_start, slot_end) WITH &&
    ) WHERE (status IN ('SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'));
    ```
  - Terminal statuses (`CANCELLED`, `NO_SHOW`) are excluded from overlap checks.
  - *Prisma Limitation*: Because Prisma schema syntax does not natively represent PostgreSQL exclusion constraints, these constraints will be applied via a custom SQL migration script during Phase 3 database setup.

### 3.4 Database Transaction and Concurrency Strategy
- **Isolation Level**: All billing operations, queue token allocations, MRN increments, and appointment bookings run within Prisma transactions (`prisma.$transaction`) configured with `ReadCommitted` or `Serializable` isolation.
- **Row-Level Concurrency Locks**:
  - Atomic sequence increments (`mrn_sequences`) execute `SELECT ... FOR UPDATE` row locks to serialize concurrent receptionist registrations without duplicate key errors.
- **Optimistic Concurrency**:
  - Clinical consultations maintain a `version: Int @default(1)` column to detect concurrent edits during drafting.

### 3.5 Clinical Record Lifecycle, Finalisation and Addenda [OWNER APPROVED]
- **Lifecycle Invariant**:
  A consultation record is **NEVER** created when an appointment is booked, a patient checks in, a queue token is issued, or a patient enters the waiting room.
  The creation occurs **only when the doctor calls the patient, the patient enters the room, and the doctor formally commences the consultation**.
- **Finalization & Immutability**:
  - The consultation transitions to `FINALIZED` upon explicit doctor action.
  - Finalized consultations are permanently locked.
  - Any subsequent clinical observation or clarification must be appended as a signed row in `consultation_addenda` with author ID, timestamp, and mandatory justification.
- **Administrative Access Boundaries**:
  - Hospital Administrators have authorized read access for governance and legal compliance.
  - Administrative access to confidential clinical health records triggers an audit log entry (`CLINICAL_RECORD_ADMIN_OVERRIDE`).
  - Administrators **cannot alter or delete** a doctor's finalized consultation notes, and cannot author clinical records. Any administrative note must follow the signed-addendum workflow.

### 3.6 Proposed Prescription Amendment Workflow [PROPOSED]
- Once issued upon consultation finalization, prescriptions become permanently immutable.
- To modify a medication order:
  1. The doctor marks the existing item as `DISCONTINUED` with a mandatory clinical justification reason (e.g. "Adverse reaction", "Dosage adjustment").
  2. A new replacement item is authored, linked to the discontinued item via `superseded_by_item_id`.
  3. The original item is preserved in the database, ensuring zero silent modifications and complete traceability.

### 3.7 Receptionist Financial vs Clinical Boundary & Information Leakage Prevention
- **Architectural Boundary**: Separate Controller & Service Data Transfer Objects (DTOs).
- Receptionist queries select only demographic data (`PatientDemographicDTO`: MRN, Name, Phone, DOB, Gender, Emergency Contacts) and financial records (Invoices, Payments).
- Fields such as `consultations`, `diagnoses`, `clinicalRemarks`, `prescriptions`, and `dietPlans` are **never selected** in queries executed for receptionist roles at the database query level.

### 3.8 Medical Document Storage and Secure Downloads
- Uploaded medical scans and system-generated PDFs are stored on a private filesystem directory (`storage/documents/`).
- Downloads route through an authenticated endpoint: `GET /api/v1/documents/:id/download` verifying user role and patient linkage. Receptionists are strictly denied.
- Files stream with appropriate `Content-Disposition` headers after verifying the stored SHA-256 checksum.

### 3.9 Audit-Log Integrity, Tamper Detection and Threat Boundaries
- **Append-Only Database Permissions**:
  `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM medora_app_user;`
- **Cryptographic Hash Chaining [PROPOSED]**:
  Every audit record includes a SHA-256 `record_hash = SHA256(fields + previous_hash)`.
- **Honest Threat Modeling & Security Boundaries**:
  - Protects against application-level exploits and malicious staff credentials.
  - Does **not** protect against a privileged PostgreSQL superuser/DBA with direct database shell access. True non-repudiation requires periodically exporting hash checkpoints to an external immutable ledger or WORM cloud storage.

### 3.10 Browser-Based PDF Generation Deployment Architecture [PROPOSED / UNRESOLVED]

| Architecture Option | Description | Advantages | Disadvantages |
| :--- | :--- | :--- | :--- |
| **Option A: Embedded Chromium in Backend Container** | Headless Chromium runs directly inside the Node.js Express container process via `puppeteer-core`. | - Simple single-container setup for local development.<br>- Zero network latency between Express and Chromium.<br>- Simpler deployment for initial development phases. | - Increases backend container image size (~250 MB).<br>- Chromium process memory spikes could compete with Express for RAM under high traffic. |
| **Option B: Separate PDF Rendering Service (Sidecar)** | A dedicated lightweight microservice (Node.js + Chromium) listening on an internal HTTP endpoint exclusively for PDF rendering requests. | - Isolates heavy browser memory and CPU spikes from API traffic.<br>- Independent scaling of PDF generation.<br>- Tighter security sandboxing around the browser process. | - Additional container orchestration overhead.<br>- Internal network latency for transmitting HTML and binary PDF buffers. |

- **Engineering Recommendation**: Use **Option A (Embedded Chromium)** for local development and Phase 3 foundation setup to maintain developer velocity and simplicity. Transition to **Option B (Dedicated Sidecar)** in production environments if document rendering volume requires horizontal isolation.

---

## 4. Standard API Response Envelope
All API endpoints return a uniform JSON envelope:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "timestamp": "2026-11-12T12:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "SLOT_OVERLAP_CONFLICT",
    "message": "The selected time window overlaps with an existing appointment.",
    "details": [
      {
        "field": "slotStart",
        "issue": "Doctor has an existing active appointment during this interval."
      }
    ]
  },
  "timestamp": "2026-11-12T12:00:00.000Z"
}
```
