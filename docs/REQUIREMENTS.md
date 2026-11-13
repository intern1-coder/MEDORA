# Medora — System Requirements Specification

## 1. Requirement Identifier Scheme & Status Definitions

### 1.1 Status Classifications
Every requirement in this specification is categorized under one of four distinct engineering statuses:
- **OWNER APPROVED**: Explicitly reviewed and confirmed by the project owner.
- **PROPOSED**: Recommended by the software engineering team; awaiting formal owner sign-off.
- **IMPLEMENTED**: Fully coded in application source code, verified with passing automated tests.
- **UNRESOLVED**: Requires owner decision, domain clarification, or additional investigation.

### 1.2 Module Identifiers
- **AUTH**: Authentication and Authorization
- **HOSP**: Hospital and Department Hierarchy
- **DOCT**: Doctor Profile and Schedule Management
- **PAT**: Patient Management and Demographics
- **APPT**: Appointment Booking and Slot Management
- **QUEUE**: Live Queue and Token Operations
- **CONS**: Clinical Consultation and Examination
- **PRES**: Prescriptions and Medication
- **DIET**: Dietary Plans and Nutrition
- **REP**: Patient PDF Reports
- **DOC**: Medical Documents and Attachments
- **FOL**: Follow-ups and Care Continuity
- **NOTIF**: Notifications and Alerts
- **BILL**: Reception, Billing and Payments
- **AUD**: Audit Logging and System Security

---

## 2. Functional Requirements Specification

### 2.1 Authentication & Authorization (REQ-AUTH)
- **REQ-AUTH-001 [OWNER APPROVED]**: The system shall authenticate users using email/username and salted hashed passwords using the **Argon2id** algorithm. *(Proposed configuration: memory cost 64 MB, 3 passes, 16-byte random salt).*
- **REQ-AUTH-002 [PROPOSED]**: The system shall issue JSON Web Tokens (short-lived access tokens + rotating refresh tokens) for session management.
- **REQ-AUTH-003 [OWNER APPROVED]**: The system shall enforce Role-Based Access Control (RBAC) across all endpoints according strictly to the four approved application roles: `PATIENT`, `DOCTOR`, `RECEPTIONIST`, and `HOSPITAL_ADMIN`.
- **REQ-AUTH-004 [PROPOSED]**: The system shall support immediate session revocation on logout, password reset, or account deactivation.
- **REQ-AUTH-005 [PROPOSED]**: The system shall lock accounts temporarily after 5 consecutive failed login attempts.

### 2.2 Hospital & Department Management (REQ-HOSP)
- **REQ-HOSP-001 [OWNER APPROVED]**: Hospital Administrators shall create and manage hospital departments (e.g., Cardiology, Pediatrics, General Medicine).
- **REQ-HOSP-002 [OWNER APPROVED]**: Doctors can be affiliated with multiple departments simultaneously (`DoctorDepartment` junction).
- **REQ-HOSP-003 [OWNER APPROVED]**: Each department shall define operating hours, physical rooms, and assigned doctor staff.
- **REQ-HOSP-004 [PROPOSED]**: Deletion of departments shall be soft-deleted to maintain historical integrity.

### 2.3 Doctor Profile, Schedules & Consultation Access (REQ-DOCT)
- **REQ-DOCT-001 [OWNER APPROVED]**: Doctor profiles shall record license number, specializations, qualifications, consultation fees, assigned room, and department affiliations.
- **REQ-DOCT-002 [OWNER APPROVED]**: Doctors shall define weekly availability schedules with discrete slot intervals (e.g., 15, 30, or 45 minutes).
- **REQ-DOCT-003 [OWNER APPROVED]**: Doctors shall be able to mark leave or unavailable windows, preventing slot bookings.
- **REQ-DOCT-004 [OWNER APPROVED]**: A doctor shall have full access to view their own consultation history (all consultations personally authored by that doctor).
- **REQ-DOCT-005 [OWNER APPROVED]**: A doctor shall NOT freely browse other doctors' consultations. Access to consultations authored by other doctors requires an authorized active care relationship (scheduled appointment, active queue token, or explicit referral) and is audited.

### 2.4 Patient Management & Access (REQ-PAT)
- **REQ-PAT-001 [OWNER APPROVED]**: Every patient shall have a unique Medical Record Number in format `MED-YYYY-XXXXX`.
  - *Sequence Reset Policy*: **[UNRESOLVED - DEC-004A]** Annual timezone reset vs continuous sequence across years.
  - *Sequence Limit Policy*: **[UNRESOLVED - DEC-004B]** Strict 5-digit cap (99,999) with admin alert vs sequence expansion.
- **REQ-PAT-002 [OWNER APPROVED]**: Patient profiles shall store full name, date of birth, biological sex, contact info, emergency contacts, blood group, recorded allergies, and existing chronic conditions.
- **REQ-PAT-003 [OWNER APPROVED]**: Receptionists shall be able to register new patients and search existing patients by MRN, phone, or name.
- **REQ-PAT-004 [OWNER APPROVED]**: Receptionist views must strictly exclude consultation notes, diagnoses, prescriptions, and clinical history.
- **REQ-PAT-005 [OWNER APPROVED]**: Patients can view and download only their own permitted records (finalized consultation summaries, prescriptions, diet plans, invoices, and reports).

### 2.5 Appointments (REQ-APPT)
- **REQ-APPT-001 [OWNER APPROVED]**: Patients or receptionists shall book appointments for an available doctor slot.
- **REQ-APPT-002 [OWNER APPROVED]**: The system must enforce overlap protection:
  - A doctor cannot have overlapping active appointments, regardless of varying slot durations.
  - A patient cannot have overlapping active appointments across different doctors/departments.
  - Overlap evaluates only active states (`SCHEDULED`, `CHECKED_IN`, `IN_CONSULTATION`). Cancelled or no-show appointments must not block slots.
- **REQ-APPT-003 [OWNER APPROVED]**: Appointment statuses shall transition strictly: `SCHEDULED` -> `CHECKED_IN` -> `IN_CONSULTATION` -> `COMPLETED` or `CANCELLED` / `NO_SHOW`.
- **REQ-APPT-004 [OWNER APPROVED]**: Cancellation must record the cancellation reason and timestamp.

### 2.6 Walk-in & Live Queue Management (REQ-QUEUE)
- **REQ-QUEUE-001 [OWNER APPROVED]**: The system shall operate an appointment-aware queue with controlled clinical urgency priority, balancing scheduled appointments and walk-in patients.
- **REQ-QUEUE-002 [OWNER APPROVED]**: Receptionists shall issue walk-in queue tokens mapped to a specific department or doctor.
- **REQ-QUEUE-003 [OWNER APPROVED]**: Receptionists are **strictly forbidden** from assigning clinical urgency. Under the current approved 4-role baseline, **only DOCTOR** is authorized to assign or elevate clinical urgency (`URGENT` or `EMERGENCY`) with a recorded clinical justification and audit log.
- **REQ-QUEUE-004 [PROPOSED]**: The queue service shall evaluate patient call order using a 5-tier hierarchical queue model: (1) Authorized clinical urgency, (2) Appointment-window handling, (3) Waiting-time fairness, (4) Walk-in handling, and (5) Missed-call and requeue handling. *(Arbitrary numerical weight formulas removed).*
- **REQ-QUEUE-005 [PROPOSED]**: Token status transitions: `WAITING` -> `CALLED` -> `ENGAGED` -> `SERVED` (or `MISSED` / `CANCELLED`).
- **REQ-QUEUE-006 [PROPOSED]**: If a called patient does not report within an established window (e.g. 3 calls / 10 minutes), the token transitions to `MISSED`. A missed patient may be re-queued by reception, but is placed behind currently waiting on-schedule patients.

### 2.7 Clinical Consultation Lifecycle (REQ-CONS)
- **REQ-CONS-001 [MANDATORY LIFECYCLE RULE - OWNER APPROVED]**: A consultation record must **NEVER** be created merely because an appointment was booked, a patient checked in, a token was generated, or a patient entered the waiting room.
- **REQ-CONS-002 [OWNER APPROVED]**: A consultation record is created **only when the doctor calls the patient, the patient enters the room, and the doctor formally commences the consultation**.
- **REQ-CONS-003 [OWNER APPROVED]**: While status is `IN_PROGRESS`, the consultation remains editable by the consulting doctor.
- **REQ-CONS-004 [OWNER APPROVED]**: Consultations record chief complaints, vital signs, physical examination findings, provisional/final diagnoses, and private doctor remarks.
- **REQ-CONS-005 [OWNER APPROVED]**: Upon doctor finalization, the consultation transitions to `FINALIZED` and becomes permanently locked. Direct modification or deletion is blocked.
- **REQ-CONS-006 [OWNER APPROVED]**: Corrections or retrospective notes must be recorded as signed addenda (`ConsultationAddendum`) preserving author ID, timestamp, justification, and reference to the original consultation.
- **REQ-CONS-007 [OWNER APPROVED]**: Hospital Administrators have authorized read access across clinical consultations for governance/legal compliance. All administrative access to clinical records is strictly audited (`CLINICAL_RECORD_ADMIN_OVERRIDE`). Administrators cannot alter consultations silently or author clinical records.

### 2.8 Prescriptions & Diet Plans (REQ-PRES & REQ-DIET)
- **REQ-PRES-001 [OWNER APPROVED]**: Prescriptions must be authored and issued exclusively by the consulting doctor during an active consultation.
- **REQ-PRES-002 [OWNER APPROVED]**: Every prescription item must explicitly differentiate:
  1. Brand / actual medicine name
  2. Generic medicine name
  3. Active pharmaceutical ingredient (chemical/API name)
  4. Strength
  5. Dosage form
  6. Dose and administration instructions
  7. Frequency
  8. Duration
  9. Relation to food
  10. Doctor's additional instructions or precautions.
- **REQ-PRES-003 [OWNER APPROVED]**: The doctor enters and verifies all prescription details. The system shall **never** invent medicine names, chemical names, dosage recommendations, or instructions.
- **REQ-PRES-004 [PROPOSED]**: Prescription finalisation and amendment workflow:
  - An issued prescription becomes permanently immutable upon consultation finalization.
  - An issued prescription can **never** be silently overwritten or modified.
  - Corrections or medication changes require marking the existing item as `DISCONTINUED` with a mandatory clinical reason and creating a new prescription item, preserving the full audit trail.
- **REQ-DIET-001 [OWNER APPROVED]**: Diet plans are optional, authorable and approvable exclusively by doctors.
- **REQ-DIET-002 [OWNER APPROVED]**: The system shall never independently generate or issue clinical diet plans.
- **REQ-DIET-003 [OWNER APPROVED]**: Patients can view and download approved diet plans.

### 2.9 Patient PDF Reports & Documents (REQ-REP & REQ-DOC)
- **REQ-REP-001 [OWNER APPROVED]**: The system shall generate PDF documents for consultation summaries, prescriptions, diet plans, and billing receipts using browser-based HTML template rendering.
- **REQ-REP-002 [PROPOSED / UNRESOLVED]**: PDF Chromium deployment architecture: embedded in backend container vs separate rendering service.
- **REQ-DOC-001 [OWNER APPROVED]**: The system shall track patient medical documents (lab scans, external reports) with mime-type, storage path, SHA-256 checksum, patient link, and uploader identity.

### 2.10 Reception & Billing (REQ-BILL)
- **REQ-BILL-001 [OWNER APPROVED]**: The system shall generate itemized invoices upon patient check-in or walk-in registration.
- **REQ-BILL-002 [OWNER APPROVED]**: Receptionists shall view invoices, outstanding balances, and record payments across all supported tenders (Cash, Card, UPI, Insurance).
- **REQ-BILL-003 [OWNER APPROVED]**: Billing receipts receive an immutable sequential receipt number upon issuance.
- **REQ-BILL-004 [OWNER APPROVED]**: Receptionist queries must be architecturally isolated from clinical data fields.

### 2.11 Audit Logging & Tamper Detection (REQ-AUD)
- **REQ-AUD-001 [OWNER APPROVED]**: All access and modifications to patient records, appointments, queues, consultations, and billing must record actor ID, IP address, timestamp, action type, and entity ID.
- **REQ-AUD-002 [OWNER APPROVED]**: Audit logs are append-only; application database users are denied `UPDATE`, `DELETE`, and `TRUNCATE` permissions.
- **REQ-AUD-003 [PROPOSED]**: Cryptographic hash chaining: each audit record computes `SHA256(fields + previous_hash)` for tamper detection. *(Note: Does not protect against direct superuser/DBA rewriting unless anchored to external WORM storage).*
