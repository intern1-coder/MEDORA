// src/tests/hospitalOperations.test.ts
import { BloodGroup, Gender, Role, UserStatus } from '@prisma/client';
import * as departmentService from '../services/department.service';
import * as doctorService from '../services/doctor.service';
import * as staffService from '../services/staff.service';
import * as patientService from '../services/patient.service';
import { prisma } from '../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';

jest.mock('../config/database', () => ({
  prisma: {
    department: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    doctorProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    doctorSchedule: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    doctorLeave: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    mRNSequence: {
      upsert: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('Core Hospital Operations Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Department Management', () => {
    it('should create a department with code and room numbers', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.department.create as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        name: 'Cardiology',
        code: 'CARD',
        roomNumbers: ['101', '102'],
        isActive: true,
      });

      const res = await departmentService.createDepartment({
        name: 'Cardiology',
        code: 'CARD',
        roomNumbers: ['101', '102'],
      });

      expect(res.code).toBe('CARD');
      expect(res.roomNumbers).toEqual(['101', '102']);
    });

    it('should prevent duplicate department code', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        departmentService.createDepartment({
          name: 'Cardiology',
          code: 'CARD',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should soft-delete department setting deletedAt timestamp', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue({ id: 'dep-1' });
      (prisma.department.update as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        deletedAt: new Date(),
        isActive: false,
      });

      const deleted = await departmentService.deleteDepartment('dep-1');
      expect(deleted.isActive).toBe(false);
      expect(deleted.deletedAt).toBeDefined();
    });
  });

  describe('Doctor Management', () => {
    it('should register doctor profile linked to user account', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u-1', role: Role.DOCTOR });
      (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.doctorProfile.create as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        licenseNumber: 'DOC-12345',
        specialization: 'Cardiology',
      });

      const doc = await doctorService.createDoctorProfile({
        userId: 'u-1',
        licenseNumber: 'DOC-12345',
        specialization: 'Cardiology',
        qualifications: 'MBBS, MD',
        consultationFee: 50.0,
        departmentIds: ['dep-1'],
      });

      expect(doc.licenseNumber).toBe('DOC-12345');
    });

    it('should compute available slots considering doctor leaves', async () => {
      (prisma.doctorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        defaultSlotMinutes: 15,
      });
      // Doctor is on leave for this date
      (prisma.doctorLeave.findFirst as jest.Mock).mockResolvedValue({ id: 'leave-1' });

      const slots = await doctorService.getDoctorAvailableSlots('doc-1', '2026-12-01');
      expect(slots).toEqual([]);
    });
  });

  describe('Staff Management', () => {
    it('should prevent creating a PATIENT via staff endpoint', async () => {
      await expect(
        staffService.createStaffUser({
          email: 'patient@test.com',
          password: 'Password123!',
          role: Role.PATIENT,
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should update staff status and revoke tokens when suspended', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-2',
        role: Role.RECEPTIONIST,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'u-2',
        status: UserStatus.SUSPENDED,
      });

      const updated = await staffService.updateStaffStatus('u-2', UserStatus.SUSPENDED);
      expect(updated.status).toBe(UserStatus.SUSPENDED);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenInvalidBefore: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('Patient Management', () => {
    it('should generate formatted MRN MED-YYYY-XXXXX upon patient registration', async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.mRNSequence.upsert as jest.Mock).mockResolvedValue({
        year: 2026,
        currentValue: 42,
      });
      (prisma.patient.create as jest.Mock).mockResolvedValue({
        id: 'pat-1',
        mrn: 'MED-2026-00042',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      const pat = await patientService.registerPatient({
        firstName: 'Jane',
        lastName: 'Doe',
        dob: '1995-05-15',
        gender: Gender.FEMALE,
        phone: '+1234567890',
        emergencyContactName: 'John Doe',
        emergencyContactPhone: '+1987654321',
      });

      expect(pat.mrn).toBe('MED-2026-00042');
    });

    it('should filter patients by MRN or search keyword', async () => {
      (prisma.patient.count as jest.Mock).mockResolvedValue(1);
      (prisma.patient.findMany as jest.Mock).mockResolvedValue([
        { id: 'pat-1', mrn: 'MED-2026-00042', firstName: 'Jane' },
      ]);

      const res = await patientService.listPatients({ search: 'Jane' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].mrn).toBe('MED-2026-00042');
    });
  });
});
