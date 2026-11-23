// Authentication service for MED-005
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
} from '../errors/AppError';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateRandomToken,
  generateAccessToken,
  needsRehash
} from '../utils/security';
import { AuthTokens, JwtTokenPayload, UserAuthProfile } from '../types/auth';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { env } from '../config/env';
import { logger } from '../config/logger';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Register a new patient (public registration is forced to PATIENT role).
 */
export async function registerUser(input: RegisterInput): Promise<{ user: UserAuthProfile; tokens: AuthTokens }> {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new ConflictError(`User with email '${input.email}' already exists`);
  }

  const assignedRole = Role.PATIENT;
  const hashedPassword = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: hashedPassword,
      role: assignedRole,
      status: UserStatus.ACTIVE
    }
  });

  const tokens = await issueTokens(user.id, user.email, user.role, user.status);
  return { user: sanitizeUser(user), tokens };
}

/**
 * Authenticate user credentials and issue tokens.
 */
export async function authenticateUser(
  input: LoginInput,
  deviceInfo?: string
): Promise<{ user: UserAuthProfile; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new ForbiddenError('Account is suspended. Please contact administrator.');
  }
  if (user.status === UserStatus.INACTIVE) {
    throw new ForbiddenError('Account is inactive.');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
    throw new ForbiddenError(`Account is temporarily locked due to excessive failed attempts. Try again in ${remaining} minute(s).`);
  }

  const isValid = await verifyPassword(user.passwordHash, input.password);
  if (!isValid) {
    const attempts = user.failedLoginAttempts + 1;
    let lockedUntil: Date | null = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      logger.warn(`Account locked due to ${MAX_FAILED_ATTEMPTS} failed logins: ${user.email}`);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil }
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (await needsRehash(user.passwordHash)) {
    const rehashed = await hashPassword(input.password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: rehashed } });
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });
  }

  const tokens = await issueTokens(user.id, user.email, user.role, user.status, deviceInfo);
  return { user: sanitizeUser(user), tokens };
}

/**
 * Refresh token rotation with strict reuse detection.
 * Returns either a successful token pair or a structured result indicating a problem.
 */
export async function refreshUserSession(
  rawRefreshToken: string,
  deviceInfo?: string
): Promise<{ user: UserAuthProfile; tokens: AuthTokens }> {
  const tokenHash = hashToken(rawRefreshToken);
  const now = new Date();

  const txnResult = await prisma.$transaction(async (tx) => {
    // Attempt to claim the token (only if not revoked).
    const claim = await tx.refreshToken.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true, revokedAt: now }
    });

    if (claim.count === 0) {
      // Token already used or unknown.
      const existing = await tx.refreshToken.findFirst({
        where: { tokenHash },
        include: { user: true }
      });
      if (!existing) {
        return { kind: 'invalid' as const };
      }
      // Revoke the whole family (only active tokens).
      await tx.refreshToken.updateMany({
        where: { familyId: existing.familyId, isRevoked: false },
        data: { isRevoked: true, revokedAt: now }
      });
      return { kind: 'reuse' as const };
    }

    const stored = await tx.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true }
    });
    if (!stored) {
      return { kind: 'invalid' as const };
    }
    if (stored.expiresAt < now) {
      return { kind: 'expired' as const };
    }
    const user = stored.user;
    if (user.status !== UserStatus.ACTIVE) {
      return { kind: 'inactive' as const };
    }
    if (user.tokenInvalidBefore && stored.createdAt < user.tokenInvalidBefore) {
      return { kind: 'invalidated' as const };
    }

    // Generate new pair.
    const newRefresh = generateRandomToken(40);
    const newHash = hashToken(newRefresh);
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    });
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create replacement token.
    const replacement = await tx.refreshToken.create({
      data: {
        userId: user.id,
        familyId: stored.familyId,
        tokenHash: newHash,
        deviceInfo: deviceInfo ?? stored.deviceInfo,
        expiresAt: newExpires
      }
    });

    // Link old token to replacement (no encrypted payload).
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { replacedByTokenId: replacement.id }
    });

    return {
      kind: 'ok' as const,
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken: newRefresh,
        tokenType: 'Bearer' as const,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN
      }
    };
  }, { timeout: 10000 });

  // Resolve result after transaction commit.
  switch (txnResult.kind) {
    case 'reuse':
      logger.warn('Refresh token reuse detected – session family revoked.');
      throw new UnauthorizedError('Refresh token reuse detected. Session family revoked.');
    case 'invalid':
      throw new UnauthorizedError('Invalid refresh token');
    case 'expired':
      throw new UnauthorizedError('Refresh token has expired');
    case 'inactive':
      throw new ForbiddenError('Account is not active');
    case 'invalidated':
      throw new UnauthorizedError('Session has been invalidated');
    case 'ok':
      return { user: txnResult.user, tokens: txnResult.tokens };
    default:
      throw new UnauthorizedError('Unexpected authentication error');
  }
}

/**
 * Invalidate a specific refresh token or all sessions for a user.
 */
export async function logoutUser(userId: string, rawRefreshToken?: string): Promise<void> {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, userId },
      data: { isRevoked: true }
    });
  } else {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
  }
}

/**
 * Emergency revocation of all sessions for a user.
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenInvalidBefore: new Date() }
  });
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true }
  });
}

/**
 * Retrieve a user profile.
 */
export async function getUserProfile(userId: string): Promise<UserAuthProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError('User profile not found');
  }
  return sanitizeUser(user);
}

// Helper to issue a token pair (only stores refresh token hash).
async function issueTokens(
  userId: string,
  email: string,
  role: Role,
  status: UserStatus,
  deviceInfo?: string
): Promise<AuthTokens> {
  const accessToken = generateAccessToken({ userId, email, role, status });
  const rawRefresh = generateRandomToken(40);
  const tokenHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, deviceInfo: deviceInfo ?? null, expiresAt }
  });
  return {
    accessToken,
    refreshToken: rawRefresh,
    tokenType: 'Bearer' as const,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  };
}

function sanitizeUser(user: { id: string; email: string; role: Role; status: UserStatus; createdAt: Date; updatedAt: Date }): UserAuthProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
