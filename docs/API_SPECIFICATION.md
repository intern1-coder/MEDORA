# Medora — API Specification

## 1. Protocol & Conventions
- **Base URL**: `/api/v1`
- **Transport**: HTTPS
- **Payload Format**: `application/json`
- **Authentication**: Bearer Token in `Authorization: Bearer <JWT>` header
- **Standard HTTP Codes**:
  - `200 OK`: Request succeeded.
  - `201 Created`: Resource successfully created.
  - `400 Bad Request`: Validation failure or client semantic error.
  - `401 Unauthorized`: Missing, expired, or invalid authentication credentials.
  - `403 Forbidden`: Authenticated user lacks permission for the requested resource.
  - `404 Not Found`: Target resource does not exist.
  - `409 Conflict`: Unique constraint violation or slot concurrency conflict.
  - `422 Unprocessable Entity`: Business rule validation error.
  - `500 Internal Server Error`: Unhandled server exception.

---

## 2. API Endpoint Groups (Phase by Phase)

### Auth (`/api/v1/auth`)
- `POST /register` — Register initial user (Super Admin or Patient self-registration).
- `POST /login` — Authenticate and receive access + refresh token.
- `POST /refresh` — Rotate refresh token and issue new access token.
- `POST /logout` — Invalidate refresh token.
- `GET /me` — Retrieve active authenticated user profile.

### Hospitals & Departments (`/api/v1/departments`)
- `POST /` — Create department (Admin).
- `GET /` — List active departments.
- `GET /:id` — Get department details.
- `PUT /:id` — Update department (Admin).
- `DELETE /:id` — Soft-delete department (Admin).

### Doctors (`/api/v1/doctors`)
- `POST /` — Create doctor profile (Admin).
- `GET /` — List doctors with department filter.
- `GET /:id` — Get doctor profile & public schedule.
- `PUT /:id/schedule` — Set working hours / slots (Doctor or Admin).
- `GET /:id/available-slots` — Query free slots for a date.

### Patients (`/api/v1/patients`)
- `POST /` — Register patient (Receptionist or Admin).
- `GET /` — Search/filter patients (MRN, phone, name).
- `GET /:id` — Get patient demographic profile.
- `PUT /:id` — Update patient details.

### Appointments (`/api/v1/appointments`)
- `POST /` — Book appointment slot.
- `GET /` — List appointments (filter by doctor, patient, date, status).
- `GET /:id` — Get appointment details.
- `PATCH /:id/status` — Transition appointment status (`CHECKED_IN`, `CANCELLED`, etc.).

### Queue & Tokens (`/api/v1/queue`)
- `POST /tokens` — Issue walk-in token.
- `GET /tokens/live` — Get live department/doctor queue board.
- `PATCH /tokens/:id/call` — Call next patient (Doctor / Receptionist).
- `PATCH /tokens/:id/status` — Update token status (`SERVED`, `MISSED`, etc.).

### Consultations (`/api/v1/consultations`)
- `POST /` — Start consultation session (Doctor).
- `GET /:id` — Get consultation record (Doctor or Patient for own record).
- `PUT /:id` — Save consultation notes, vitals, diagnosis (Doctor).
- `POST /:id/finalize` — Finalize and lock consultation (Doctor).
- `POST /:id/addendum` — Append signed addendum (Doctor).

### Prescriptions & Diet (`/api/v1/prescriptions`, `/api/v1/diet-plans`)
- `POST /prescriptions` — Create prescription (Doctor).
- `GET /prescriptions/:id` — View prescription details.
- `GET /prescriptions/:id/pdf` — Download signed prescription PDF.
- `POST /diet-plans` — Create dietary plan (Doctor).
- `GET /diet-plans/:id` — View diet plan.
- `GET /diet-plans/:id/pdf` — Download diet plan PDF.

### Billing & Reception (`/api/v1/billing`)
- `POST /invoices` — Create invoice.
- `GET /invoices/:id` — Get invoice details.
- `POST /invoices/:id/payments` — Record payment transaction.
- `GET /invoices/:id/receipt-pdf` — Download payment receipt PDF.
- `GET /reports/daily-summary` — Daily financial reconciliation (Admin / Receptionist).

### Audit Logs (`/api/v1/audit-logs`)
- `GET /` — Filter and view system audit records (Admin only).
