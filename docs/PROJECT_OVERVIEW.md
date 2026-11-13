# Medora — Project Overview

## 1. System Identity and Purpose
**Medora** is an enterprise-grade Hospital Appointment, Patient Records, and Queue Management System designed to streamline clinical workflows, patient registrations, queue allocations, doctor consultations, prescriptions, dietary planning, and billing.

## 2. Core Functional Modules
1. **Authentication & Access Control**: Secure token-based authentication with granular Role-Based Access Control (RBAC).
2. **Hospital & Department Management**: Organizational hierarchies, clinical departments, room/opd allocations.
3. **Staff & Doctor Profiles**: Specializations, working schedules, slot durations, consulting rooms.
4. **Patient Management**: Centralized electronic health profile, demographic information, emergency contacts, medical history.
5. **Appointments & Scheduling**: Advance booking, slot-based appointments, rescheduling, cancellations.
6. **Walk-in & Live Queue Management**: Real-time token generation, queue status tracking, priority handling, doctor room routing.
7. **Consultations & Clinical Records**: Chief complaints, vitals, clinical examination notes, diagnoses (ICD-ready), private clinical remarks.
8. **Prescriptions & Diet Plans**: Structured medication orders, dosage instructions, duration, doctor-approved customized diet charts.
9. **Patient PDF Reports**: On-demand tamper-evident PDF generation for consultation summaries, prescriptions, and receipts.
10. **Reception & Billing**: Fee collections, invoice/receipt generation, payment tracking, daily cash-flow summaries.
11. **Security, Audit Logging & Notifications**: Immutable audit trails for all sensitive patient data access and state transitions.

## 3. Technology Stack Baseline
- **Runtime**: Node.js (Current active: v26.8.2)
- **Language**: TypeScript (Strict Mode enabled)
- **Framework**: Express.js
- **Database Engine**: PostgreSQL (via Docker container in local development)
- **Object-Relational Mapping (ORM)**: Prisma ORM
- **Request Validation & Data Contracts**: Zod
- **Testing Suite**: Jest & Supertest
- **API Documentation**: OpenAPI 3.0 / Swagger UI
- **Containerization**: Docker & Docker Compose

## 4. Current Phase
- **Phase 0**: Workspace inspection and project planning (Baseline establishment).
- **Status**: Planning and baseline documentation initialized. Implementation awaiting Phase review and project owner approval.
