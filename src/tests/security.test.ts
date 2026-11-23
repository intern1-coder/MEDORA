import { Role, UserStatus } from '@prisma/client';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  hashToken,
  generateRandomToken,
  generateAccessToken,
  verifyAccessToken
} from '../utils/security';
import { ROLE_PERMISSIONS, PERMISSIONS } from '../constants/roles';

describe('Security and Cryptographic Utilities', () => {
  describe('Argon2id Hashing & Verification', () => {
    it('should hash a password using argon2id and verify it successfully', async () => {
      const password = 'StrongPassword123!@#';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword(hash, 'WrongPassword123!@#');
      expect(isInvalid).toBe(false);
    });

    it('should determine needsRehash accurately', async () => {
      const password = 'StrongPassword123!@#';
      const hash = await hashPassword(password);
      const rehash = await needsRehash(hash);
      expect(typeof rehash).toBe('boolean');
    });
  });

  describe('Token Operations (SHA256 & Random Bytes)', () => {
    it('should generate secure random tokens of requested length', () => {
      const token1 = generateRandomToken(32);
      const token2 = generateRandomToken(32);
      expect(token1).toHaveLength(64); // hex
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('should compute consistent SHA-256 hash for tokens', () => {
      const token = 'sample-random-refresh-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('JWT Operations', () => {
    const payload = {
      userId: '11111111-2222-3333-4444-555555555555',
      email: 'doctor@medora.local',
      role: Role.DOCTOR,
      status: UserStatus.ACTIVE
    };

    it('should generate and verify a valid JWT access token', () => {
      const token = generateAccessToken(payload);
      expect(token).toBeDefined();

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.status).toBe(payload.status);
    });

    it('should throw an error when verifying an invalid token', () => {
      expect(() => verifyAccessToken('invalid.jwt.token')).toThrow();
    });
  });

  describe('Role & Granular Permission Mapping', () => {
    it('should strictly enforce DOCTOR permissions and deny receptionist clinical access', () => {
      const doctorPerms = ROLE_PERMISSIONS[Role.DOCTOR];
      const receptionistPerms = ROLE_PERMISSIONS[Role.RECEPTIONIST];
      const patientPerms = ROLE_PERMISSIONS[Role.PATIENT];
      const adminPerms = ROLE_PERMISSIONS[Role.HOSPITAL_ADMIN];

      // DOCTOR permissions
      expect(doctorPerms).toContain(PERMISSIONS.CONDUCT_CONSULTATION);
      expect(doctorPerms).toContain(PERMISSIONS.AUTHOR_PRESCRIPTION);
      expect(doctorPerms).toContain(PERMISSIONS.ASSIGN_CLINICAL_URGENCY);

      // RECEPTIONIST must NEVER have clinical permissions
      expect(receptionistPerms).not.toContain(PERMISSIONS.CONDUCT_CONSULTATION);
      expect(receptionistPerms).not.toContain(PERMISSIONS.AUTHOR_PRESCRIPTION);
      expect(receptionistPerms).not.toContain(PERMISSIONS.ASSIGN_CLINICAL_URGENCY);
      expect(receptionistPerms).not.toContain(PERMISSIONS.RECORD_VITALS);
      expect(receptionistPerms).toContain(PERMISSIONS.ISSUE_QUEUE_TOKEN);
      expect(receptionistPerms).toContain(PERMISSIONS.COLLECT_PAYMENTS);

      // PATIENT permissions
      expect(patientPerms).toContain(PERMISSIONS.VIEW_OWN_CLINICAL_SUMMARY);
      expect(patientPerms).toContain(PERMISSIONS.BOOK_OWN_APPOINTMENT);
      expect(patientPerms).not.toContain(PERMISSIONS.AUTHOR_PRESCRIPTION);

      // HOSPITAL_ADMIN permissions
      expect(adminPerms).toContain(PERMISSIONS.MANAGE_STAFF);
      expect(adminPerms).toContain(PERMISSIONS.VIEW_AUDIT_LOGS);
      expect(adminPerms).not.toContain(PERMISSIONS.CONDUCT_CONSULTATION); // Separation of admin from clinical authorship
    });
  });
});
