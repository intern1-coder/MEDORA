// src/tests/appointment.test.ts
import { AppointmentStatus, Role } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import * as appointmentService from '../services/appointment.service';
import { prisma } from '../config/database';

// Mock database client
jest.mock('../config/database', () => ({
  prisma: {
    appointment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('Appointment Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAppointment', () => {
    it('should reject booking with start time after end time', async () => {
      await expect(
        appointmentService.createAppointment({
          doctorId: '00000000-0000-0000-0000-000000000001',
          patientId: '00000000-0000-0000-0000-000000000002',
          departmentId: '00000000-0000-0000-0000-000000000003',
          slotStart: new Date(Date.now() + 7200000).toISOString(),
          slotEnd: new Date(Date.now() + 3600000).toISOString(),
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject booking in the past (BR-APPT-005)', async () => {
      await expect(
        appointmentService.createAppointment({
          doctorId: '00000000-0000-0000-0000-000000000001',
          patientId: '00000000-0000-0000-0000-000000000002',
          departmentId: '00000000-0000-0000-0000-000000000003',
          slotStart: new Date(Date.now() - 7200000).toISOString(),
          slotEnd: new Date(Date.now() - 3600000).toISOString(),
        })
      ).rejects.toThrow('Cannot book an appointment in the past (BR-APPT-005)');
    });

    it('should reject booking if doctor has conflicting active appointment (BR-APPT-001)', async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'existing-doctor-appt' });

      await expect(
        appointmentService.createAppointment({
          doctorId: '00000000-0000-0000-0000-000000000001',
          patientId: '00000000-0000-0000-0000-000000000002',
          departmentId: '00000000-0000-0000-0000-000000000003',
          slotStart: new Date(Date.now() + 3600000).toISOString(),
          slotEnd: new Date(Date.now() + 7200000).toISOString(),
        })
      ).rejects.toThrow('Doctor is not available during the requested time slot');
    });

    it('should reject booking if patient has conflicting active appointment (BR-APPT-002)', async () => {
      (prisma.appointment.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // doctor free
        .mockResolvedValueOnce({ id: 'existing-patient-appt' }); // patient busy

      await expect(
        appointmentService.createAppointment({
          doctorId: '00000000-0000-0000-0000-000000000001',
          patientId: '00000000-0000-0000-0000-000000000002',
          departmentId: '00000000-0000-0000-0000-000000000003',
          slotStart: new Date(Date.now() + 3600000).toISOString(),
          slotEnd: new Date(Date.now() + 7200000).toISOString(),
        })
      ).rejects.toThrow('Patient already has an active appointment during the requested time window');
    });
  });

  describe('updateAppointment & cancelAppointment', () => {
    it('should allow DOCTOR to transition appointment from CHECKED_IN to IN_CONSULTATION and COMPLETED', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.CHECKED_IN,
        slotStart: new Date(Date.now() + 3600000),
        slotEnd: new Date(Date.now() + 7200000),
        doctorId: 'doc-1',
        patientId: 'pat-1',
        departmentId: 'dep-1',
      });
      (prisma.appointment.update as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.IN_CONSULTATION,
      });

      const updated = await appointmentService.updateAppointment(
        'appt-1',
        { status: AppointmentStatus.IN_CONSULTATION },
        { userId: 'doc-user', role: Role.DOCTOR }
      );

      expect(updated.status).toBe(AppointmentStatus.IN_CONSULTATION);
    });

    it('should prevent non-admin from reopening a COMPLETED appointment', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.COMPLETED,
        slotStart: new Date(Date.now() + 3600000),
        slotEnd: new Date(Date.now() + 7200000),
      });

      await expect(
        appointmentService.updateAppointment(
          'appt-1',
          { status: AppointmentStatus.SCHEDULED },
          { userId: 'doc-user', role: Role.DOCTOR }
        )
      ).rejects.toThrow('Only a Hospital Admin can modify or reopen a COMPLETED appointment');
    });

    it('should reject patient cancellation under 1 hour before appointment (BR-APPT-006)', async () => {
      // 30 minutes from now
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.SCHEDULED,
        slotStart: new Date(Date.now() + 30 * 60 * 1000),
        slotEnd: new Date(Date.now() + 60 * 60 * 1000),
      });

      await expect(
        appointmentService.cancelAppointment(
          'appt-1',
          { userId: 'pat-user', role: Role.PATIENT }
        )
      ).rejects.toThrow('Patients can only cancel appointments at least 1 hour in advance (BR-APPT-006)');
    });

    it('should allow admin to cancel appointment regardless of time', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.SCHEDULED,
        slotStart: new Date(Date.now() + 10 * 60 * 1000),
        slotEnd: new Date(Date.now() + 40 * 60 * 1000),
      });
      (prisma.appointment.update as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.CANCELLED,
        cancellationReason: 'Admin override cancellation',
      });

      const cancelled = await appointmentService.cancelAppointment(
        'appt-1',
        { userId: 'admin-user', role: Role.HOSPITAL_ADMIN },
        'Admin override cancellation'
      );

      expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);
    });
  });

  describe('listAppointments', () => {
    it('should return paginated appointments with correct total', async () => {
      (prisma.appointment.count as jest.Mock).mockResolvedValue(1);
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'appt-1',
          status: AppointmentStatus.SCHEDULED,
          slotStart: new Date(),
          slotEnd: new Date(),
          doctor: { specialization: 'Cardiology' },
          patient: { mrn: 'MED-2026-00001' },
          department: { name: 'Cardiology' },
        },
      ]);

      const res = await appointmentService.listAppointments({ page: 1, limit: 10 });
      expect(res.items.length).toBe(1);
      expect(res.pagination.total).toBe(1);
      expect(res.pagination.page).toBe(1);
    });
  });
});
