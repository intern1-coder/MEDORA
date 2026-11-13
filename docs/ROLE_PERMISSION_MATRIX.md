# Medora — Role-Permission Matrix

## 1. Approved Application Roles Baseline [OWNER APPROVED]
The Medora application operates strictly on four confirmed application-level roles:

1. **PATIENT**: Personal healthcare profile owner. Can book appointments for self, view own appointment history, view own finalized consultation summaries, view own prescriptions, view own approved diet plans, view own invoices/receipts, and download own medical reports.
2. **DOCTOR**: Licensed healthcare provider. Can manage own availability/leave schedules, view own patient consultation history, view assigned patient records, conduct consultations, record diagnoses, author prescriptions, author/approve diet plans, and assign clinical urgency.
3. **RECEPTIONIST**: Front-desk operational staff. Can register patient demographics, schedule appointments, issue walk-in queue tokens, manage visit check-in status, view doctor availability and consultation fee schedules, view invoices, and collect payments. Strictly denied access to all clinical records.
4. **HOSPITAL_ADMIN**: Operational hospital leadership. Authorized system-wide administrative oversight across departments, staff accounts, doctor schedules, appointments, queues, billing, and audited clinical governance. Administrative access is distinct from clinical authorship.

> [!IMPORTANT]
> **Separation of Infrastructure and Application Roles**:
> Database administrators (DBAs), DevOps engineers, deployment service accounts, and hosting infrastructure operators are managed at the operating system, container, and database engine levels. They are not application-level user roles.

---

## 2. Granular Permissions Matrix

| Domain Operation / Resource | HOSPITAL_ADMIN | DOCTOR | RECEPTIONIST | PATIENT |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Staff Accounts & Department Config** | Full | None | None | None |
| **Manage Doctor Working Schedules & Leave** | Full | Own Schedule Only | Read-Only | Read-Only |
| **Register & Edit Patient Demographics** | Full | Read All | Full (Demographics Only) | Own Profile |
| **View Doctor's Own Consultation History** | Audited Read | Full (Self-Authored) | **STRICTLY DENIED** | Denied |
| **View Other Doctors' Consultations** | **Audited Read** | Restricted (Active Referral/Care Only, Audited) | **STRICTLY DENIED** | Denied |
| **View Patient Permitted Clinical History** | **Audited Read** | Treating Doctor Only (Audited) | **STRICTLY DENIED** | Own Finalized Summary |
| **Book & Reschedule Appointments** | Full | Read Own | Full | Own Appointments Only |
| **Manage Queue Tokens (Walk-ins)** | Full | Own Department Queue | Issue / Update Status | View Own Status |
| **Assign Clinical Urgency Priority** | Denied | **Authorized DOCTOR Only** (Audited) | **STRICTLY DENIED** | Denied |
| **Record Vital Signs** | Denied | Full (Consultation Session) | **STRICTLY DENIED** | Denied |
| **Conduct Consultation Sessions** | Denied | Assigned Doctor Only | **STRICTLY DENIED** | Denied |
| **View Clinical Notes & Diagnoses** | **Audited Read** | Treating Doctor / Author | **STRICTLY DENIED** | Own Finalized Summary |
| **Finalize Consultation & Signed Addenda** | Denied | Authoring Doctor Only | **STRICTLY DENIED** | Denied |
| **Author Prescriptions** | Denied | Consulting Doctor Only | **STRICTLY DENIED** | Denied |
| **View Prescriptions** | **Audited Read** | Full (Clinical Care) | **STRICTLY DENIED** | Own Prescriptions |
| **Author & Approve Diet Plans** | Denied | Consulting Doctor Only | **STRICTLY DENIED** | Denied |
| **View Approved Diet Plans** | **Audited Read** | Full (Clinical Care) | **STRICTLY DENIED** | Own Diet Plans |
| **View Medical Documents & Scans** | **Audited Read** | Treating Doctor | **STRICTLY DENIED** | Own Documents |
| **Invoicing, Payments & Receipts** | Full | Denied | Full | Own Invoices |
| **View Financial Reports & Shift Cash** | Full | Denied | Shift Totals Only | Denied |
| **View System Audit Logs** | Full | Denied | **STRICTLY DENIED** | Denied |

---

## 3. Detailed Access Boundaries & Governance Rules

### 3.1 Doctor Consultation History and Clinical Access
1. **Doctor's Own Consultation History**:
   - A doctor has full access to the complete history of consultation records that they personally authored.
   - This supports the doctor's ongoing longitudinal view of their patients and previous medical judgments.
2. **Other Doctors' Consultations**:
   - A doctor **cannot** freely browse other doctors' consultations.
   - Access to consultations authored by other doctors requires an authorized active care relationship:
     - The patient has an active appointment with the reviewing doctor, OR
     - The patient is actively checked into the reviewing doctor's queue, OR
     - An explicit clinical referral or consultation transfer was recorded.
   - Any cross-doctor record retrieval is logged in the audit trail.
3. **Patient History Access**:
   - Patients can view and download only their own finalized clinical summaries, prescriptions, diet plans, documents, and billing receipts. Patients cannot view in-progress consultation drafts or private doctor remarks.
   - Treating doctors can view historical clinical summaries and allergies for patients currently under their active care.

### 3.2 Receptionist Access & Strict Clinical Privacy
- **Permitted Access**:
  - Patient demographics (MRN, Name, Phone, DOB, Gender, Emergency Contacts).
  - Appointment history and visit statuses (`SCHEDULED`, `CHECKED_IN`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`, `NO_SHOW`).
  - Doctor profiles, specializations, consulting rooms, schedules, and standard fee tariffs.
  - Department information and operational hours.
  - Invoices, outstanding balances, payment collections, and receipt issuance.
- **Strictly Denied**:
  - Consultation notes, clinical examination findings, vitals, provisional and final diagnoses.
  - Prescriptions (medicines, active ingredients, dosages, instructions).
  - Diet plans.
  - Clinical attachments and medical history.
  - **Clinical Urgency Assignment**: Receptionists are **strictly forbidden** from assigning clinical urgency (`URGENT` or `EMERGENCY`). Receptionists issue standard walk-in tokens only.

### 3.3 Hospital Administrator Governance Boundary
- **System-Wide Operational Authority**: Hospital Administrators oversee departments, user accounts, operational schedules, and financial ledgers.
- **Separation of Administration from Clinical Authorship**:
  - Administrators are **not** clinical authors and cannot create, modify, or finalize consultations, diagnoses, prescriptions, or diet plans.
  - Administrators **cannot silently alter or delete** a doctor's finalized consultation notes. Any administrative observation must follow the signed-addendum workflow.
- **Audited Clinical Access**:
  - Administrative read access to clinical records is permitted for legal, ethical, and governance compliance, but **automatically generates an immutable audit log entry** (`CLINICAL_RECORD_ADMIN_OVERRIDE`).

---

## 4. Proposals for Future Consideration [PROPOSED / NOT APPROVED]

### 4.1 Proposal: Technical SUPER_ADMIN Application Role
- *Use Case*: A system maintenance role separate from hospital operations, used solely for global system health checks, software update verifications, and tenant provisioning in multi-hospital deployments.
- *Security Implications*: Consolidates high-privilege configuration capabilities. If compromised, it bypasses tenant boundaries.
- *Status*: **PROPOSED**. Not part of the confirmed application role baseline.

### 4.2 Proposal: Dedicated TRIAGE_NURSE Role
- *Use Case*: Outpatient intake desk support to perform pre-consultation vital signs recording and clinical urgency triage prior to the doctor consultation.
- *Status*: **PROPOSED**. Under the current approved baseline, pre-consultation urgency assignment is restricted to `DOCTOR`.
