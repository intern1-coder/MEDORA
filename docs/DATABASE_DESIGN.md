# Medora — Database Architecture and Schema Design Specification

## 1. Relational Database Overview & Technology Stack
- **Database Engine**: PostgreSQL 16+ (Host verified: `psql 18.6`)
- **Object-Relational Mapping (ORM)**: Prisma ORM (Client v5+)
- **Draft Schema Location**: [prisma/schema.prisma](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/prisma/schema.prisma)
- **Entity-Relationship Diagram**: [docs/ER_DIAGRAM.md](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/ER_DIAGRAM.md)
- **Naming Conventions**:
  - Tables & Columns in PostgreSQL: `snake_case` (mapped via `@map` and `@@map`).
  - Fields & Models in Prisma / TypeScript: `camelCase` and `PascalCase`.
- **Primary Keys**: UUIDv4 (`@id @default(uuid()) @db.Uuid`) for security against enumeration attacks, except `MRNSequence` which uses integer `year` as PK.
- **Monetary Precision**: All financial fields use `Decimal(10, 2)` (`@db.Decimal(10, 2)`). Floating-point types are strictly forbidden.
- **Timezone Standard**: All temporal coordinates (`slot_start`, `slot_end`, `called_at`, timestamps) are stored in UTC (`TIMESTAMPTZ`). Presentation conversion to the hospital's local timezone occurs in the application layer.

---

## 2. Patient Clinical History Architecture
### Derived Longitudinal History vs Duplicated Free-Text History
A fundamental architectural decision in Medora is that **a patient's medical history is derived dynamically from structured clinical encounters rather than stored in a separate, free-text historical summary table**:

1. **Foundational Baseline Attributes**:
   - The `Patient` record stores only verified baseline demographic and clinical constants: `bloodGroup`, recorded verified allergies (`allergies: String[]`), and chronic pre-existing conditions (`existingConditions: String[]`).
2. **Longitudinal Clinical Records**:
   - Past diagnoses, physical examinations, vitals, and physician observations are derived from immutable `Consultation` and `Diagnosis` records.
   - Past and active medications are derived from immutable `Prescription` and `PrescriptionItem` records.
   - Diagnostic reports and imaging scans are derived from `MedicalDocument` records.
3. **Clinical Justification**:
   - Storing a separate free-text "medical history" column or table creates dangerous synchronization gaps, where new diagnoses or medication changes are recorded in consultations but fail to update the summary, creating clinical liability.
   - Deriving history directly from signed encounters guarantees that every clinical data point has a verifiable author, timestamp, and legal audit trail.

---

## 3. Entity Catalogue & Responsibilities

| Entity Model | Domain Module | Primary Key | Responsibility & Boundary |
| :--- | :--- | :--- | :--- |
| **User** | Identity & Auth | UUID | Core credentials, Argon2id password hash, role (`PATIENT`, `DOCTOR`, `RECEPTIONIST`, `HOSPITAL_ADMIN`), brute-force locking counters, and instant revocation timestamps. |
| **RefreshToken** | Identity & Auth | UUID | Rotating refresh token session hashes with family revocation flags and device metadata. |
| **MRNSequence** | Identity & Sequences | Int (Year) | Atomic annual sequence counter for concurrency-safe MRN generation. |
| **Department** | Hospital Facilities | UUID | Clinical departments (Cardiology, Pediatrics, etc.), operating status, and room identifiers. |
| **DoctorProfile** | Hospital Facilities | UUID | Doctor professional credentials, license number, consultation fees, default slot intervals, and bio. |
| **DoctorDepartment** | Hospital Facilities | UUID | Junction entity modeling many-to-many affiliations between doctors and departments with `isPrimary` flag. |
| **DoctorSchedule** | Hospital Facilities | UUID | Weekly recurring availability templates (day of week, start time, end time) for slot generation. |
| **DoctorLeave** | Hospital Facilities | UUID | Doctor leave intervals blocking slot bookings. |
| **Patient** | Patient Management | UUID | Patient demographics, unique MRN (`MED-YYYY-XXXXX`), baseline blood group, allergies, existing conditions, and emergency contacts. |
| **Appointment** | Scheduling | UUID | Time-bounded slot reservations between patient and doctor with active status tracking and overlap protection. |
| **QueueToken** | Queue Management | UUID | Daily department/doctor patient tokens with status transitions (`WAITING`, `CALLED`, `ENGAGED`, `SERVED`, `MISSED`, `CANCELLED`) and doctor-assigned urgency. |
| **Consultation** | Clinical Records | UUID | Clinical encounter row created strictly when the doctor begins the consultation; captures vitals, complaints, examination notes, and private remarks. |
| **Diagnosis** | Clinical Records | UUID | Structured provisional and final diagnoses linked to consultations with optional ICD codes. |
| **ConsultationAddendum**| Clinical Records | UUID | Signed post-finalization amendments preserving author doctor, timestamp, and mandatory clinical justification. |
| **Prescription** | Clinical Records | UUID | Header for medications issued during a consultation session. |
| **PrescriptionItem** | Clinical Records | UUID | Normalized medication orders capturing brand name, generic name, active ingredient, strength, dosage form, instructions, food relation, and discontinuation tracking. |
| **DietPlan** | Clinical Records | UUID | Doctor-approved dietary recommendations, caloric targets, and food restrictions. |
| **DietMealItem** | Clinical Records | UUID | Meal-specific recommendations (Breakfast, Lunch, Dinner, etc.) for a diet plan. |
| **MedicalDocument** | Documents | UUID | Metadata, storage paths, and SHA-256 checksums for external lab scans and system-generated report PDFs. |
| **FollowUp** | Care Continuity | UUID | Recommended future clinical review dates with status tracking (`PENDING`, `SCHEDULED`, `COMPLETED`, `OVERDUE`). |
| **Invoice** | Billing | UUID | Itemized financial invoices linked to patient visits with net amount calculation. |
| **InvoiceItem** | Billing | UUID | Line-item charges (Consultation fee, procedures, medications). |
| **Payment** | Billing | UUID | Multi-tender payment transactions (Cash, Card, UPI, Insurance) with unique receipt numbers and receptionist attribution. |
| **Notification** | Notifications | UUID | User notification queue for appointment reminders, queue calls, and payment receipts. |
| **AuditLog** | Security & Auditing | UUID | Tamper-evident append-only audit trail capturing actor, action, entity, payload, and cryptographic hash chaining. |

---

## 4. Relationship Design & Referential Actions

```
[User] (1) ──(0..1) [DoctorProfile]
[User] (1) ──(0..1) [Patient]
[User] (1) ──(0..N) [RefreshToken] (Cascade delete on user removal)
[User] (1) ──(0..N) [Notification] (Cascade delete on user removal)
[User] (1) ──(0..N) [AuditLog] (SetNull on user removal to preserve audit history)

[DoctorProfile] (1) ──(1..N) [DoctorDepartment] (Cascade) ──(N..1) [Department] (Restrict)
[DoctorProfile] (1) ──(0..N) [DoctorSchedule] (Cascade)
[DoctorProfile] (1) ──(0..N) [DoctorLeave] (Cascade)

[Patient] (1) ──(0..N) [Appointment] (Restrict) ──(N..1) [DoctorProfile] (Restrict)
[Department] (1) ──(0..N) [Appointment] (Restrict)

[Appointment] (1) ──(0..1) [QueueToken] (SetNull on appointment cancellation)
[Department] (1) ──(0..N) [QueueToken] (Restrict)
[DoctorProfile] (1) ──(0..N) [QueueToken] (Restrict)
[Patient] (1) ──(0..N) [QueueToken] (Restrict)

[Consultation] (1) ──(0..1) [Appointment] (Restrict)
[Consultation] (1) ──(0..1) [QueueToken] (Restrict)
[Consultation] (1) ──(1) [Patient] (Restrict)
[Consultation] (1) ──(1) [DoctorProfile] (Restrict)
[Consultation] (1) ──(1) [Department] (Restrict)

[Consultation] (1) ──(0..N) [Diagnosis] (Cascade delete only if consultation draft deleted)
[Consultation] (1) ──(0..1) [Prescription] (Restrict)
[Consultation] (1) ──(0..1) [DietPlan] (Restrict)
[Consultation] (1) ──(0..N) [ConsultationAddendum] (Restrict)
[Consultation] (1) ──(0..N) [MedicalDocument] (SetNull)
[Consultation] (1) ──(0..N) [FollowUp] (Restrict)

[Prescription] (1) ──(1..N) [PrescriptionItem] (Cascade)
[PrescriptionItem] (1) ──(0..1) [PrescriptionItem] (Self-reference via supersededByItemId, SetNull)

[DietPlan] (1) ──(0..N) [DietMealItem] (Cascade)

[Patient] (1) ──(0..N) [Invoice] (Restrict)
[Appointment] (1) ──(0..1) [Invoice] (SetNull)
[Invoice] (1) ──(1..N) [InvoiceItem] (Cascade)
[Invoice] (1) ──(0..N) [Payment] (Restrict)
[User] (1) ──(0..N) [Payment] (Restrict)
```

### Referential Integrity Principles
- **No Cascading Deletion of Clinical Data**: Clinical encounters (`Consultation`), legal prescriptions (`Prescription`), billing records (`Invoice`), and payments (`Payment`) use `onDelete: Restrict`. They can never be accidentally cascaded if a referenced profile is modified.
- **Cascade Restricted to Owned Child Collections**: Subordinate line items that have no independent clinical existence (`PrescriptionItem` under `Prescription`, `InvoiceItem` under `Invoice`, `DietMealItem` under `DietPlan`) cascade with their parent header.

---

## 5. Critical Database Invariants

### 5.1 Consultation Lifecycle Invariant [OWNER APPROVED]
- A consultation record is **NEVER** created when an appointment is booked, a patient checks in, a queue token is issued, or a patient enters the waiting room.
- Row creation occurs **strictly when the doctor calls the patient into the room and begins the consultation**.
- The `Consultation` row establishes direct foreign keys to `patient_id`, `doctor_id`, `appointment_id` (nullable for walk-ins), and `department_id`.
- Finalized consultations lock permanently (`status = 'FINALIZED'`). Direct updates to clinical fields are blocked. Subsequent clarifications must insert into `consultation_addenda`.

### 5.2 Appointment Overlap Protection Invariant
- **Rule**: Neither a doctor nor a patient can have overlapping active appointments.
- **Interval Formula**:
  $$\text{SlotA.start} < \text{SlotB.end} \quad \text{AND} \quad \text{SlotA.end} > \text{SlotB.start}$$
- **PostgreSQL Database-Level Exclusion Constraints**:
  To enforce this deterministically under high concurrency, PostgreSQL requires exclusion constraints utilizing the `btree_gist` extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;

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
- **Prisma ORM Limitation**: Prisma does not natively support range types (`tstzrange`) or GIST exclusion constraints in `schema.prisma`. In Phase 3, this constraint will be deployed via a custom SQL migration file (`prisma migrate --create-only`).

### 5.3 Concurrency-Safe MRN Management (`MED-YYYY-XXXXX`)
- Uniqueness is guaranteed at the database level via `CREATE UNIQUE INDEX idx_patients_mrn ON patients (mrn);`.
- Concurrency generation uses atomic row locking on `mrn_sequences`:
  ```sql
  INSERT INTO mrn_sequences (year, current_value, updated_at)
  VALUES ($year, 1, NOW())
  ON CONFLICT (year)
  DO UPDATE SET current_value = mrn_sequences.current_value + 1, updated_at = NOW()
  RETURNING current_value;
  ```
- **Unresolved Owner Policies**:
  - `DEC-004A`: Sequence reset to `00001` at midnight hospital local timezone on Jan 1st vs continuous sequence.
  - `DEC-004B`: Enforce strict 5-digit cap (max 99,999) with administrative alert vs dynamic sequence expansion beyond 5 digits.

### 5.4 Queue Policy & Urgency Governance
- Tokens transition: `WAITING` -> `CALLED` -> `ENGAGED` -> `SERVED` (or `MISSED` / `CANCELLED`).
- **Clinical Urgency Authority**: Under the approved 4-role baseline, only **DOCTOR** can assign `URGENT` or `EMERGENCY` priority. Receptionists are strictly barred from setting clinical urgency.
- Numerical weighting formulas have been removed. The proposed queue model uses a 5-tier hierarchical policy. Emergency arrivals bypass standard queue queues and are routed immediately.

### 5.5 Prescription Amendment & Discontinuation Lifecycle [PROPOSED]
- Issued prescriptions are immutable upon consultation finalization.
- Modifications require marking an item as `DISCONTINUED` with a recorded clinical reason (`discontinuation_reason`) and timestamp (`discontinued_at`).
- Replacement items link to predecessor items via `superseded_by_item_id`, preserving full legal and clinical auditability.

---

## 6. Security-Related Data Boundaries
1. **Receptionist Query Projection Isolation**: Receptionists have zero relational access to `Consultation`, `Diagnosis`, `PrescriptionItem`, and `DietPlan`.
2. **Hospital Administrator Clinical Auditing**: Administrative read access to clinical records is logged as `CLINICAL_RECORD_ADMIN_OVERRIDE`. Administrators cannot alter or author clinical records.
3. **Audit Log Non-Repudiation**: Application database user is denied `UPDATE`, `DELETE`, and `TRUNCATE` permissions on `audit_logs`. Cryptographic hash chaining (`previous_hash` + `record_hash`) detects table tampering.
