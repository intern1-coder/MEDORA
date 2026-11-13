# Medora — Business Rules Specification

## 1. Authentication & System Roles (BR-AUTH)
- **BR-AUTH-001**: Passwords must be at least 8 characters long, containing uppercase, lowercase, numerical, and special characters.
- **BR-AUTH-002 [OWNER APPROVED]**: Password hashing algorithm is **Argon2id**. Plaintext or reversible passwords are never stored. *(Proposed engineering baseline: memory cost 64 MB, 3 passes, 16-byte random salt).*
- **BR-AUTH-003 [PROPOSED]**: Inbound refresh tokens rotate on every usage. Detected reuse of an invalidated refresh token results in family revocation across all active sessions for that user.
- **BR-AUTH-004**: Inactive or suspended user accounts cannot authenticate under any condition.
- **BR-AUTH-005 [OWNER APPROVED]**: The system operates strictly on four confirmed application roles: `PATIENT`, `DOCTOR`, `RECEPTIONIST`, and `HOSPITAL_ADMIN`. Infrastructure and database administration accounts are managed externally.

---

## 2. Doctor Consultation History & Access Control (BR-ACCESS)

### 2.1 Doctor's Own Consultation History [OWNER APPROVED]
- A licensed doctor has full access to the complete history of clinical consultations they personally authored.
- This historical record is preserved to maintain longitudinal continuity of the doctor's clinical practice and diagnostic history.

### 2.2 Other Doctors' Consultations [OWNER APPROVED]
- A doctor **cannot** freely browse or query consultations authored by other doctors.
- Access to another doctor's consultation record is permitted **only** when an authorized care relationship exists:
  1. The patient has an active appointment with the reviewing doctor, OR
  2. The patient is checked into the reviewing doctor's active queue, OR
  3. An explicit clinical referral or consultation transfer was recorded.
- Any access to another doctor's consultation record is logged in the system audit trail.

### 2.3 Patient Permitted History [OWNER APPROVED]
- Patients can access, view, and download only their own finalized consultation summaries, prescriptions, diet plans, and billing receipts. Patients cannot access in-progress consultation drafts or private doctor remarks.
- Authorized treating doctors can access the relevant clinical medical history (past diagnoses, recorded allergies, active prescriptions) of patients currently under their care.

---

## 3. Patient Identity & Medical Record Numbers (BR-PAT)
- **BR-PAT-001 [OWNER APPROVED]**: Every patient is assigned a unique Medical Record Number in format `MED-YYYY-XXXXX` (`MED`: system prefix, `YYYY`: 4-digit registration year, `XXXXX`: 5-digit sequence).
- **BR-PAT-002 [PROPOSED]**: MRN generation must be atomic and concurrency-safe, utilizing PostgreSQL row-level locking on a dedicated sequence table.
- **BR-PAT-003 [UNRESOLVED - DEC-004A]**: Annual sequence reset policy (whether sequence restarts at `00001` each year based on hospital timezone midnight or runs continuously) is awaiting owner decision.
- **BR-PAT-004 [UNRESOLVED - DEC-004B]**: Sequence limit policy (whether to strictly cap at 99,999 with administrative alert or allow sequence expansion beyond 5 digits) is awaiting owner decision.

---

## 4. Appointment Scheduling & Overlap Protection (BR-APPT)
- **BR-APPT-001**: A doctor cannot have overlapping active appointments, regardless of varying slot durations (e.g. 15, 30, 45, or 60 minutes).
- **BR-APPT-002**: A patient cannot have overlapping active appointments across different doctors or departments at the same time.
- **BR-APPT-003**: Overlap is evaluated against active statuses (`SCHEDULED`, `CHECKED_IN`, `IN_CONSULTATION`). Appointments in terminal states (`CANCELLED`, `NO_SHOW`) must never block slot availability.
- **BR-APPT-004**: Overlap condition is defined as:
  $$\text{SlotA.start} < \text{SlotB.end} \quad \text{AND} \quad \text{SlotA.end} > \text{SlotB.start}$$
  All slot boundaries are stored in UTC (`TIMESTAMPTZ`) and converted to/from the hospital's operational timezone during scheduling.
- **BR-APPT-005**: Appointments cannot be booked for historical timestamps.
- **BR-APPT-006**: Patient cancellations must occur at least 1 hour prior to slot start unless performed by authorized administrative staff.

---

## 5. Queue Policy & Priority Management (BR-QUEUE)

### 5.1 Confirmed Queue Principles [OWNER APPROVED]
- The queue operates as an appointment-aware queue balancing scheduled appointments and walk-ins.
- Walk-in tokens are fully supported and mapped to specific departments or doctors.
- Authorized clinical urgency takes precedence over standard queue order.
- **Clinical Urgency Authority**: Under the approved 4-role baseline, **only DOCTOR** is authorized to assign or elevate clinical urgency (`URGENT` or `EMERGENCY`). Receptionists are **strictly forbidden** from assigning clinical urgency. Every urgency assignment requires an explicit clinical reason and is audited.

### 5.2 Proposed Hierarchical Queue Model [PROPOSED / AWAITING OWNER REVIEW]
Rather than an arbitrary numerical weighting formula, the queue service evaluates patient call order using a structured 5-tier hierarchical policy:

1. **Tier 1: Authorized Clinical Urgency**
   - Active tokens flagged as `EMERGENCY` or `URGENT` by a licensed doctor are prioritized immediately at the head of the call list.
2. **Tier 2: Appointment-Window Handling**
   - Scheduled patients who checked in within their designated appointment time window are called during their booked slot window, preserving appointment commitments.
3. **Tier 3: Waiting-Time Fairness**
   - Among patients in the same category, earlier check-in times take precedence to ensure fairness and prevent patient neglect.
4. **Tier 4: Walk-in Handling**
   - Standard walk-in patients are interleaved into available time gaps between scheduled appointment windows and during doctor schedule buffers.
5. **Tier 5: Missed-Call & Requeue Handling**
   - If a called patient does not report within an established window (e.g., 3 calls / 10 minutes), the token transitions to `MISSED`.
   - A missed patient who subsequently reports can be re-queued into `WAITING` status by reception, but is placed behind currently waiting patients who reported on schedule.

---

## 6. Clinical Consultation Lifecycle & Immutability (BR-CONS)

### 6.1 Mandatory Lifecycle Order [OWNER APPROVED]
A consultation record must **NEVER** be created merely because an appointment was booked, a patient checked in, a token was generated, or a patient entered the waiting room.

The strict chronological workflow is:
1. **Appointment is booked**: Status is `SCHEDULED`.
2. **Patient checks in**: Status is `CHECKED_IN`.
3. **Queue token is generated**: Queue token status is `WAITING`.
4. **Doctor calls the patient**: Token status transitions to `CALLED`.
5. **Doctor begins the actual consultation**: Patient enters room; token transitions to `ENGAGED`, appointment transitions to `IN_CONSULTATION`.
6. **Consultation record is created**: The `Consultation` database row is created **only at this exact moment**, linked to patient, doctor, appointment, and department. Status is `IN_PROGRESS`.
7. **Doctor records clinical details**: Vitals, chief complaints, physical examination, provisional/final diagnoses.
8. **Doctor finalises the consultation**: Status transitions to `FINALIZED`.
9. **Finalised consultation is locked**: The record becomes permanently immutable. Direct edits or row deletions are blocked.
10. **Corrections via Signed Addenda**: Any subsequent observation or clarification must be appended as a signed `ConsultationAddendum` preserving author ID, timestamp, justification, and reference to the original consultation.

### 6.2 Administrative Access Boundaries [OWNER APPROVED]
- Hospital Administrators have authorized read access across clinical consultations for operational governance and legal compliance.
- Every administrative read of clinical records triggers an audit log (`CLINICAL_RECORD_ADMIN_OVERRIDE`).
- Hospital Administrators **cannot alter or delete** a doctor's finalized consultation notes, and cannot author clinical records. Any administrative note must follow the signed-addendum workflow.

---

## 7. Prescription Management & Amendment Lifecycle (BR-PRES)

### 7.1 Authoring & Structure [OWNER APPROVED]
- Prescriptions must be authored, reviewed, and issued exclusively by the consulting doctor during an active consultation session.
- Every prescription item must explicitly differentiate:
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
- The doctor must select, enter, and verify the prescribed medicine and clinical details. The system shall **never** invent medicine names, chemical names, dosage recommendations, or clinical instructions.

### 7.2 Proposed Prescription Finalisation & Amendment Lifecycle [PROPOSED / AWAITING OWNER REVIEW]
To ensure patient safety and avoid silent clinical record alterations:
1. **Draft State (`IN_PROGRESS`)**: Prescription items may be edited by the authoring doctor while the parent consultation is in progress.
2. **Finalization (`ISSUED`)**: When the doctor finalizes the consultation, all associated prescription items transition to `ISSUED` and become permanently immutable.
3. **Amendment / Discontinuation Workflow**:
   - An issued prescription item can **never** be silently overwritten, edited, or deleted.
   - If a medication must be changed, corrected, or stopped:
     - The existing item is marked as `DISCONTINUED` with a mandatory clinical reason (e.g., "Adverse allergic reaction", "Dosage correction") and timestamp.
     - If a replacement or corrected medication is needed, a new prescription item is created and linked to the active care session, preserving the complete, traceable audit trail of what was originally prescribed, when it was changed, and why.

---

## 8. Dietary Management (BR-DIET) [OWNER APPROVED]
- **BR-DIET-001**: Diet plans are completely optional and supplementary.
- **BR-DIET-002**: Only licensed doctors can author, customize, or approve diet plans.
- **BR-DIET-003**: The doctor controls caloric targets, permitted foods, meal schedules, and restrictions.
- **BR-DIET-004**: The system shall never independently generate or issue clinical diet plans without doctor creation and approval.
- **BR-DIET-005**: Patients can view and download approved diet plans.

---

## 9. Reception, Financial & Billing Integrity (BR-BILL) [OWNER APPROVED]
- **BR-BILL-001**: Invoices are generated upon patient appointment check-in or walk-in registration.
- **BR-BILL-002**: Receptionists have full access to view invoices, outstanding balances, and record payments across all supported payment methods (Cash, Card, UPI, Insurance).
- **BR-BILL-003**: Payment receipts receive an immutable sequential receipt number upon issuance and cannot be altered.
- **BR-BILL-004**: Receptionist queries are architecturally restricted from viewing any clinical fields (consultation notes, diagnoses, prescriptions, diet plans).
