import request from 'supertest';
import { app } from '../app';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { hashPassword, generateAccessToken } from '../utils/security';

// Mock Prisma for unit and integration testing without database daemon
jest.mock('../config/database', () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      $disconnect: jest.fn()
    },
    checkDatabaseConnection: jest.fn()
  };
});

describe('Auth API Endpoints (/api/v1/auth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should validate password complexity and reject weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully register a new user and return tokens', async () => {
      const mockCreatedUser = {
        id: 'user-new-uuid',
        email: 'newpatient@medora.local',
        passwordHash: '$argon2id$mocked_hash',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        tokenInvalidBefore: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-id-1' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newpatient@medora.local',
          password: 'ValidPassword123!',
          role: Role.PATIENT
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('newpatient@medora.local');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should prevent privilege escalation and reject registration if non-PATIENT role is requested', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker@medora.local',
          password: 'ValidPassword123!',
          role: 'HOSPITAL_ADMIN'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 Conflict if email is already registered', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: 'exists@medora.local'
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'exists@medora.local',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 401 on non-existent email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'notfound@medora.local',
          password: 'SomePassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid email or password/i);
    });

    it('should return 403 if account is suspended', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'suspended-user',
        email: 'suspended@medora.local',
        passwordHash: '$argon2id$...',
        role: Role.PATIENT,
        status: UserStatus.SUSPENDED
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'suspended@medora.local',
          password: 'Password123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Account is suspended/i);
    });

    it('should return 403 if account is locked due to failed attempts', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'locked-user',
        email: 'locked@medora.local',
        passwordHash: '$argon2id$...',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000) // locked for next 10m
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'locked@medora.local',
          password: 'Password123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/temporarily locked/i);
    });

    it('should authenticate successfully with valid password and return tokens', async () => {
      const realHash = await hashPassword('DoctorPassword123!');
      const mockUser = {
        id: 'doc-user-1',
        email: 'doctor@medora.local',
        passwordHash: realHash,
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        tokenInvalidBefore: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-id-1' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@medora.local',
          password: 'DoctorPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe(Role.DOCTOR);
    });

    it('should increment failedLoginAttempts on invalid password', async () => {
      const realHash = await hashPassword('CorrectPassword123!');
      const mockUser = {
        id: 'doc-user-1',
        email: 'doctor@medora.local',
        passwordHash: realHash,
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 2,
        lockedUntil: null
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, failedLoginAttempts: 3 });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@medora.local',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-user-1' },
          data: expect.objectContaining({ failedLoginAttempts: 3 })
        })
      );
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 401 when refresh token is unknown', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'unknown-token-string' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid refresh token/i);
    });

    it('should return 401 when refresh token has expired', async () => {
      const expiredStoredToken = {
        id: 'rt-expired',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 10000), // expired
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'patient@medora.local',
          role: Role.PATIENT,
          status: UserStatus.ACTIVE,
          tokenInvalidBefore: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue(expiredStoredToken);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'expired-token-string' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Refresh token has expired/i);
    });

    it('should trigger session-family revocation on genuine token reuse outside concurrency window', async () => {
      // Token exists as revoked outside grace period
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue({
        id: 'rt-revoked',
        userId: 'user-1',
        familyId: 'family-uuid-1',
        isRevoked: true,
        revokedAt: new Date(Date.now() - 60000) // 60s ago (> 15s grace window)
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'stolen-old-revoked-token' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Token reuse detected. Session family revoked./i);
      // Confirms session family revocation by familyId
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-uuid-1' },
        data: { isRevoked: true }
      });
    });

    it('should rotate token successfully on initial valid presentation', async () => {
      const validStoredToken = {
        id: 'rt-valid-1',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'patient@medora.local',
          role: Role.PATIENT,
          status: UserStatus.ACTIVE,
          tokenInvalidBefore: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue(validStoredToken);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-new-1' });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'single-active-valid-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should handle duplicate refresh immediately after rotation idempotently without revoking session family', async () => {
      const token = 'concurrent-test-token-string';
      const validStoredToken = {
        id: 'rt-concurrent-1',
        userId: 'user-concurrent-1',
        familyId: 'family-concurrent-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        user: {
          id: 'user-concurrent-1',
          email: 'concurrent@medora.local',
          role: Role.PATIENT,
          status: UserStatus.ACTIVE,
          tokenInvalidBefore: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      // Request 1: Wins atomic rotation
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValueOnce(validStoredToken);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValueOnce({ id: 'rt-new-first' });
      (prisma.refreshToken.update as jest.Mock).mockResolvedValueOnce({});

      const res1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token });

      expect(res1.status).toBe(200);
      const firstAccessToken = res1.body.data.tokens.accessToken;
      const firstRefreshToken = res1.body.data.tokens.refreshToken;

      // Request 2: Arrives immediately after with the identical token (simultaneous/duplicate request)
      // Database updateMany returns 0 (already claimed by Request 1)
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      // Database findFirst returns the record saved by Request 1 with encrypted tokens and recent revokedAt
      const { encryptSecret } = require('../utils/security');
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'rt-concurrent-1',
        userId: 'user-concurrent-1',
        familyId: 'family-concurrent-1',
        isRevoked: true,
        revokedAt: new Date(), // within 15s window
        encryptedAccessToken: encryptSecret(firstAccessToken),
        encryptedNewToken: encryptSecret(firstRefreshToken),
        user: validStoredToken.user
      });

      const res2 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      // Both requests obtain the same valid tokens
      expect(res2.body.data.tokens.accessToken).toBe(firstAccessToken);
      expect(res2.body.data.tokens.refreshToken).toBe(firstRefreshToken);
      // Session family was NOT revoked
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId: 'family-concurrent-1' },
          data: { isRevoked: true }
        })
      );
    });

    it('should safely handle simultaneous refresh requests across independent application instances or restarts', async () => {
      const parallelToken = 'parallel-token-string';
      const validStoredToken = {
        id: 'rt-parallel-1',
        userId: 'user-parallel-1',
        familyId: 'family-parallel-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        user: {
          id: 'user-parallel-1',
          email: 'parallel@medora.local',
          role: Role.PATIENT,
          status: UserStatus.ACTIVE,
          tokenInvalidBefore: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      // Instance 1 claims token
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValueOnce(validStoredToken);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValueOnce({ id: 'rt-parallel-new' });
      (prisma.refreshToken.update as jest.Mock).mockResolvedValueOnce({});

      const resInstance1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: parallelToken });

      expect(resInstance1.status).toBe(200);
      const generatedAccess = resInstance1.body.data.tokens.accessToken;
      const generatedRefresh = resInstance1.body.data.tokens.refreshToken;

      // Instance 2 receives duplicate request after Instance 1 rotated token in DB
      // Demonstrates multi-instance / post-restart recovery without in-memory state
      const { encryptSecret } = require('../utils/security');
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'rt-parallel-1',
        userId: 'user-parallel-1',
        familyId: 'family-parallel-1',
        isRevoked: true,
        revokedAt: new Date(), // within grace period
        encryptedAccessToken: encryptSecret(generatedAccess),
        encryptedNewToken: encryptSecret(generatedRefresh),
        user: validStoredToken.user
      });

      const resInstance2 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: parallelToken });

      expect(resInstance2.status).toBe(200);
      expect(resInstance2.body.data.tokens.accessToken).toBe(generatedAccess);
      expect(resInstance2.body.data.tokens.refreshToken).toBe(generatedRefresh);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should invalidate token and return 200 OK with specific refresh token', async () => {
      const testToken = generateAccessToken({
        userId: 'user-1',
        email: 'test@medora.local',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE,
        tokenInvalidBefore: null
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ refreshToken: 'token-to-revoke' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Logged out successfully');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
          data: { isRevoked: true }
        })
      );
    });

    it('should revoke all user sessions when logout is called without a refresh token', async () => {
      const testToken = generateAccessToken({
        userId: 'user-1',
        email: 'test@medora.local',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        role: Role.PATIENT,
        status: UserStatus.ACTIVE,
        tokenInvalidBefore: null
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRevoked: false },
        data: { isRevoked: true }
      });
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return the authenticated user profile', async () => {
      const testToken = generateAccessToken({
        userId: 'user-me-1',
        email: 'me@medora.local',
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-me-1',
        email: 'me@medora.local',
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('me@medora.local');
      expect(res.body.data.role).toBe(Role.DOCTOR);
    });
  });
});
