import request from 'supertest';
import express, { Request, Response } from 'express';
import { Role, UserStatus } from '@prisma/client';
import {
  authenticate,
  authorizeRoles,
  authorizePermission,
  authorizeOwnerOrAdmin
} from '../middlewares/auth';
import { generateAccessToken } from '../utils/security';
import { PERMISSIONS } from '../constants/roles';
import { errorHandler } from '../middlewares/errorHandler';
import { prisma } from '../config/database';

jest.mock('../config/database', () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn()
      }
    }
  };
});

function createAuthTestApp() {
  const app = express();
  app.use(express.json());

  // Test Route 1: Protected by authenticate only
  app.get('/test/protected', authenticate, (req: Request, res: Response) => {
    res.json({ success: true, user: req.user });
  });

  // Test Route 2: Role restricted (DOCTOR only)
  app.get('/test/doctor-only', authenticate, authorizeRoles(Role.DOCTOR), (req: Request, res: Response) => {
    res.json({ success: true, message: 'Welcome Doctor' });
  });

  // Test Route 3: Role restricted (DOCTOR or HOSPITAL_ADMIN)
  app.get(
    '/test/clinical-admin',
    authenticate,
    authorizeRoles(Role.DOCTOR, Role.HOSPITAL_ADMIN),
    (req: Request, res: Response) => {
      res.json({ success: true, message: 'Welcome Doctor or Admin' });
    }
  );

  // Test Route 4: Granular permission (ISSUE_QUEUE_TOKEN)
  app.post(
    '/test/queue-token',
    authenticate,
    authorizePermission(PERMISSIONS.ISSUE_QUEUE_TOKEN),
    (req: Request, res: Response) => {
      res.json({ success: true, message: 'Token issued' });
    }
  );

  // Test Route 5: Resource ownership check (/test/users/:userId/profile)
  app.get(
    '/test/users/:userId/profile',
    authenticate,
    authorizeOwnerOrAdmin('userId'),
    (req: Request, res: Response) => {
      res.json({ success: true, message: 'Profile accessed', userId: req.params.userId });
    }
  );

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

describe('Authentication & Authorization Middlewares', () => {
  const app = createAuthTestApp();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: active user matching token
    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.id === 'doctor-uuid-1') {
        return Promise.resolve({ id: 'doctor-uuid-1', role: Role.DOCTOR, status: UserStatus.ACTIVE, tokenInvalidBefore: null });
      }
      if (where.id === 'receptionist-uuid-2') {
        return Promise.resolve({ id: 'receptionist-uuid-2', role: Role.RECEPTIONIST, status: UserStatus.ACTIVE, tokenInvalidBefore: null });
      }
      if (where.id === 'patient-uuid-3') {
        return Promise.resolve({ id: 'patient-uuid-3', role: Role.PATIENT, status: UserStatus.ACTIVE, tokenInvalidBefore: null });
      }
      if (where.id === 'admin-uuid-4') {
        return Promise.resolve({ id: 'admin-uuid-4', role: Role.HOSPITAL_ADMIN, status: UserStatus.ACTIVE, tokenInvalidBefore: null });
      }
      if (where.id === 'suspended-uuid-5') {
        return Promise.resolve({ id: 'suspended-uuid-5', role: Role.PATIENT, status: UserStatus.SUSPENDED, tokenInvalidBefore: null });
      }
      if (where.id === 'inactive-uuid-6') {
        return Promise.resolve({ id: 'inactive-uuid-6', role: Role.PATIENT, status: UserStatus.INACTIVE, tokenInvalidBefore: null });
      }
      return Promise.resolve({ id: where.id, role: Role.PATIENT, status: UserStatus.ACTIVE, tokenInvalidBefore: null });
    });
  });

  const doctorToken = generateAccessToken({
    userId: 'doctor-uuid-1',
    email: 'doctor@medora.local',
    role: Role.DOCTOR,
    status: UserStatus.ACTIVE
  });

  const receptionistToken = generateAccessToken({
    userId: 'receptionist-uuid-2',
    email: 'receptionist@medora.local',
    role: Role.RECEPTIONIST,
    status: UserStatus.ACTIVE
  });

  const patientToken = generateAccessToken({
    userId: 'patient-uuid-3',
    email: 'patient@medora.local',
    role: Role.PATIENT,
    status: UserStatus.ACTIVE
  });

  const adminToken = generateAccessToken({
    userId: 'admin-uuid-4',
    email: 'admin@medora.local',
    role: Role.HOSPITAL_ADMIN,
    status: UserStatus.ACTIVE
  });

  const suspendedToken = generateAccessToken({
    userId: 'suspended-uuid-5',
    email: 'suspended@medora.local',
    role: Role.PATIENT,
    status: UserStatus.SUSPENDED
  });

  const inactiveToken = generateAccessToken({
    userId: 'inactive-uuid-6',
    email: 'inactive@medora.local',
    role: Role.PATIENT,
    status: UserStatus.INACTIVE
  });

  describe('authenticate Middleware', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/test/protected');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/token is required/i);
    });

    it('should return 401 when Authorization header format is invalid', async () => {
      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', 'InvalidFormatHeader 12345');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid authorization header format/i);
    });

    it('should return 401 when token is invalid or malformed', async () => {
      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', 'Bearer invalid.token.structure');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid authentication token/i);
    });

    it('should return 403 when user account is SUSPENDED', async () => {
      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', `Bearer ${suspendedToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/account is suspended/i);
    });

    it('should return 403 when user account is INACTIVE', async () => {
      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', `Bearer ${inactiveToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/account is inactive/i);
    });

    it('should reject access token if user account was suspended after token was issued', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'doctor-uuid-1',
        role: Role.DOCTOR,
        status: UserStatus.SUSPENDED,
        tokenInvalidBefore: null
      });

      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/account is suspended/i);
    });

    it('should reflect live role changes in request context', async () => {
      // User holds doctorToken, but their live role in database was changed to PATIENT
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'doctor-uuid-1',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE,
        tokenInvalidBefore: null
      });

      const res = await request(app)
        .get('/test/doctor-only')
        .set('Authorization', `Bearer ${doctorToken}`);

      // Should now be forbidden because live role is PATIENT
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Role 'PATIENT' is not authorized/i);
    });

    it('should reject token if tokenInvalidBefore timestamp is newer than token issuance', async () => {
      // Set tokenInvalidBefore to 1 hour in the future relative to token iat
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'doctor-uuid-1',
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE,
        tokenInvalidBefore: new Date(Date.now() + 60 * 60 * 1000)
      });

      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Token has been revoked/i);
    });

    it('should attach user payload and allow request with valid token', async () => {
      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.userId).toBe('doctor-uuid-1');
      expect(res.body.user.role).toBe(Role.DOCTOR);
    });
  });

  describe('authorizeRoles Middleware', () => {
    it('should permit access when user has the required role', async () => {
      const res = await request(app)
        .get('/test/doctor-only')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Welcome Doctor');
    });

    it('should return 403 when user role is not allowed', async () => {
      const res = await request(app)
        .get('/test/doctor-only')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Role 'PATIENT' is not authorized/i);
    });

    it('should permit access if user matches any of the multi-role list', async () => {
      const resDoctor = await request(app)
        .get('/test/clinical-admin')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(resDoctor.status).toBe(200);

      const resAdmin = await request(app)
        .get('/test/clinical-admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);

      const resReceptionist = await request(app)
        .get('/test/clinical-admin')
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(resReceptionist.status).toBe(403);
    });
  });

  describe('authorizePermission Middleware', () => {
    it('should allow RECEPTIONIST to access queue token creation', async () => {
      const res = await request(app)
        .post('/test/queue-token')
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should deny PATIENT from issuing queue tokens', async () => {
      const res = await request(app)
        .post('/test/queue-token')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Missing required permission/i);
    });
  });

  describe('authorizeOwnerOrAdmin Middleware', () => {
    it('should allow user to access their own resource', async () => {
      const res = await request(app)
        .get('/test/users/patient-uuid-3/profile')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Profile accessed');
    });

    it('should deny user from accessing another user resource', async () => {
      const res = await request(app)
        .get('/test/users/another-user-uuid/profile')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/You can only access your own resource/i);
    });

    it('should allow HOSPITAL_ADMIN to access any user resource', async () => {
      const res = await request(app)
        .get('/test/users/patient-uuid-3/profile')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Profile accessed');
    });
  });
});
