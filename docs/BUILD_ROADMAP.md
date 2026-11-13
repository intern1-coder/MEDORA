# Medora — Build Roadmap & Progress Tracker

## 1. Development Phases Overview

| Phase | Description | Status | Gate Criteria / Blockers |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Workspace inspection and project planning | **COMPLETED** | Tooling verified, baseline docs generated |
| **Phase 1** | Requirements and backend architecture | **COMPLETED** | MED-002B reconciliation complete; 4-role baseline locked |
| **Phase 2** | Database design and relationship review | **COMPLETED (DRAFT)** | Draft Prisma schema, ER diagram, and DB design generated |
| **Phase 3** | Backend foundation (Express, TS, Prisma, Docker) | **READY TO START** | Awaiting owner sign-off on MED-003 schema review |
| **Phase 4** | Authentication and authorisation (Argon2id, RBAC, JWT) | PLANNED | Phase 3 foundation approval |
| **Phase 5** | Hospital, department, doctor, patient management | PLANNED | Phase 4 auth approval |
| **Phase 6** | Appointment and queue management | PLANNED | Phase 5 management approval |
| **Phase 7** | Consultations and medical history | PLANNED | Phase 6 scheduling approval |
| **Phase 8** | Prescriptions, diet plans and PDF reports | PLANNED | Phase 7 clinical approval |
| **Phase 9** | Reception, payments and administration | PLANNED | Phase 8 prescription approval |
| **Phase 10** | Backend integration, security and testing | PLANNED | Phase 9 billing approval |
| **Phase 11** | Frontend planning and development | FROZEN | Phase 10 backend sign-off required |

---

## 2. Phase 2 Deliverables & Review Checklist (MED-003)
- [x] Draft Prisma schema generated at [prisma/schema.prisma](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/prisma/schema.prisma) with 25 distinct models, 20 enums, UUID primary keys, and Decimal currency types.
- [x] Complete Mermaid ER diagram authored at [docs/ER_DIAGRAM.md](file:///c:/Users/Darshan/Downloads/Dicken%20JSD-I/Projects/Medora/docs/ER_DIAGRAM.md) matching the Prisma schema.
- [x] Documented rationale for derived longitudinal medical history vs separate free-text tables in `DATABASE_DESIGN.md`.
- [x] Verified consultation lifecycle invariant: row instantiated only when doctor begins consultation.
- [x] Documented PostgreSQL exclusion constraints (`EXCLUDE USING gist`) for doctor and patient slot overlap protection, alongside Prisma ORM limitations.
- [x] Documented atomic MRN concurrency sequence with explicit trade-offs for annual reset (DEC-004A) and 5-digit limit overflow (DEC-004B).
- [x] Documented safe prescription amendment and discontinuation lifecycle with self-referencing replacement keys.
- [x] Reconciled all documentation across `docs/`.
