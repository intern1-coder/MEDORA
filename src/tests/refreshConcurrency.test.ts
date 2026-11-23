// Mocked tests for refresh token concurrency handling
import { refreshUserSession } from '../services/auth.service';
import { prisma } from '../config/database';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { hashToken, generateRandomToken } from '../utils/security';

// Ensure prisma is mocked similarly to other test files
jest.mock('../config/database', () => ({
  prisma: {
    refreshToken: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn(),
    user: {}
  },
  checkDatabaseConnection: jest.fn()
}));

describe('Refresh token concurrency handling', () => {
  const rawToken = generateRandomToken(40);
  const tokenHash = hashToken(rawToken);
  const user = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'PATIENT',
    status: 'ACTIVE',
    tokenInvalidBefore: null,
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;
  const existingToken = {
    id: 'rt-1',
    userId: user.id,
    familyId: 'fam-1',
    tokenHash,
    deviceInfo: null,
    isRevoked: false,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    user
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Additional test: successful rotation returns correct token shape
  it('returns a properly shaped token pair on successful rotation', async () => {
    const txMock = {
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(existingToken),
        create: jest.fn().mockResolvedValue({ id: 'rt-2' }),
        update: jest.fn().mockResolvedValue({})
      }
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => await cb(txMock));

    const result = await refreshUserSession(rawToken);

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('tokens');
    expect(result.tokens).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: expect.any(String)
    });
  });

  // Additional test: unrelated session family isolation
  it('does not revoke tokens of a different family', async () => {
    const otherToken = { ...existingToken, familyId: 'other-fam', id: 'rt-other' } as any;
    const txMock = {
      refreshToken: {
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 }) // claim succeeds for first request
          .mockResolvedValueOnce({ count: 0 }) // second request sees revoked
          .mockResolvedValue({ count: 1 }), // family revocation (should target fam-1 only)
        findFirst: jest.fn()
          .mockResolvedValueOnce(existingToken) // first call finds token of fam-1
          .mockResolvedValueOnce(otherToken), // second call finds token of other family (unused)
        create: jest.fn().mockResolvedValue({ id: 'rt-2' })
      }
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => await cb(txMock));

    const p1 = refreshUserSession(rawToken);
    const p2 = refreshUserSession(rawToken);
    await Promise.allSettled([p1, p2]);

    expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: existingToken.familyId, isRevoked: false },
      data: { isRevoked: true, revokedAt: expect.any(Date) }
    });
  });

  // Additional test: transaction failure propagates and does not commit revocation
  it('propagates transaction errors and does not commit revocation', async () => {
    const error = new Error('DB failure');
    const txMock = {
      refreshToken: {
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 }) // claim succeeds
          .mockImplementation(() => { throw error; }), // failure after claim
        findFirst: jest.fn().mockResolvedValue(existingToken),
        create: jest.fn(),
        update: jest.fn()
      }
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => await cb(txMock));

    await expect(refreshUserSession(rawToken)).rejects.toThrow('DB failure');
    expect(txMock.refreshToken.updateMany).toHaveBeenCalledTimes(1); // only the claim
  });

  // Additional test: ensure no encrypted or plaintext replacement credentials are persisted
  it('does not store encrypted or plaintext replacement credentials', async () => {
    const txMock = {
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(existingToken),
        create: jest.fn().mockResolvedValue({ id: 'rt-2' }),
        update: jest.fn().mockResolvedValue({})
      }
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => await cb(txMock));

    await refreshUserSession(rawToken);
    const createArgs = (txMock.refreshToken.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      userId: expect.any(String),
      familyId: expect.any(String),
      tokenHash: expect.any(String),
      deviceInfo: null,
      expiresAt: expect.any(Date)
    });
    expect(createArgs.data).not.toHaveProperty('encryptedAccessToken');
    expect(createArgs.data).not.toHaveProperty('encryptedNewToken');
  });

  // Note: In the strict reuse‑detection policy, a second simultaneous request can cause the
  // replacement token generated by the first request to be revoked immediately. This is an
  // intentional trade‑off: the system favours security (preventing token reuse) over guaranteeing
  // that the first response remains usable when a race occurs.

  // Original concurrency test
  it('only one of two simultaneous refresh requests succeeds, the other triggers family revocation', async () => {
    const txMock = {
      refreshToken: {
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 }) // claim succeeds for first request
          .mockResolvedValueOnce({ count: 0 }) // second request sees already revoked
          .mockResolvedValue({ count: 1 }), // family revocation inside reuse path
        findFirst: jest.fn().mockResolvedValue(existingToken),
        create: jest.fn().mockResolvedValue({ id: 'rt-2' })
      }
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return await cb(txMock);
    });

    const p1 = refreshUserSession(rawToken);
    const p2 = refreshUserSession(rawToken);
    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.message).toMatch(/reuse detected/);

    expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: existingToken.familyId, isRevoked: false },
      data: { isRevoked: true, revokedAt: expect.any(Date) }
    });
  });
});
