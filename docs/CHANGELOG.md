# Medora — Engineering Changelog

All notable changes to the Medora project will be documented in this file in reverse chronological order.

## [Unreleased] - 2026-11-13
### Task MED-003C: Final Database Design Clarifications and Evidence Review
- **Enforcement Layer Classification**:
  - Audited all critical business rules and classified their true enforcement mechanisms across (1) Database constraints, (2) Custom SQL migrations, (3) Application/service logic, (4) Planned but not implemented, and (5) Not yet verified.
- **Clarification of Design Assertions**:
  - Reconciled MED-003B claims: clarified that UUIDs provide ID unpredictability but zero authorization on their own; role enums provide schema-level typing but zero endpoint RBAC; consultation locking requires service guards and database triggers; and receptionist isolation is an architectural query requirement, not a database-enforced row isolation.
  - Reconciled query indexing rationale for `QueueToken.urgencyAssignedById`, `PrescriptionItem.supersededByItemId`, and `MedicalDocument.uploadedByUserId`.
  - Clarified 1:1 consultation-to-prescription and diet-plan cardinality vs proposed multi-prescription clinical workflows.
  - Documented lab document metadata vs structured lab observations.
  - Classified all 5 unresolved decisions by development timing and necessity.
- **Documentation Updated**:
  - `docs/REGISTERS.md`
  - `docs/CHANGELOG.md`

### Task MED-003B: Database Schema Review, Validation Planning and Developer Knowledge Transfer
- Inspected draft schema, added 3 performance indexes, and provided developer mentorship walkthrough.

### Task MED-003: Database Architecture, ER Diagram and Prisma Schema Design (Phase 2)
- Authored initial draft `prisma/schema.prisma` with 25 models and 20 enums.
- Created `docs/ER_DIAGRAM.md` with full Mermaid visualization.

### Task MED-002B: Final Permission, Queue and Data Policy Clarification
- Locked application roles strictly to four (`PATIENT`, `DOCTOR`, `RECEPTIONIST`, `HOSPITAL_ADMIN`).
- Codified 3 distinct doctor and patient consultation history access boundaries.

### Task MED-002A: Documentation Accuracy and Business Rule Reconciliation
- Reconciled mandatory consultation lifecycle order across design files.
- Standardized four status tiers (`OWNER APPROVED`, `PROPOSED`, `IMPLEMENTED`, `UNRESOLVED`).

### Task MED-002: Requirements Finalisation, Architecture Review and Approved Decisions
- Initialized local Git repository on `develop` branch with `.gitignore`.
- Drafted ADR-002 through ADR-006.

### Task MED-001: Workspace Audit and Backend Planning
- Initialized workspace audit, verified tooling (`node`, `npm`, `psql`, `docker`), generated requirements baseline.

### Phase 0 Baseline: Workspace Inspection & Project Baseline
- Created initial documentation suite under `docs/`.
