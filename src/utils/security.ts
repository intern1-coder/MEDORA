import * as argon2 from 'argon2';
import crypto from 'crypto';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtTokenPayload } from '../types/auth';

/**
 * Argon2id password hashing parameters conforming to OWASP recommendations:
 * 64 MB memory cost, 3 passes, 1 parallelism thread.
 */
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: env.ARGON2_MEMORY_COST,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(storedHash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, plainText);
  } catch {
    return false;
  }
}

export async function needsRehash(storedHash: string): Promise<boolean> {
  try {
    return argon2.needsRehash(storedHash, {
      memoryCost: env.ARGON2_MEMORY_COST,
      timeCost: env.ARGON2_TIME_COST,
      parallelism: env.ARGON2_PARALLELISM
    });
  } catch {
    return false;
  }
}

/**
 * SHA-256 token hashing for database storage (refresh tokens).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate cryptographically secure random token bytes.
 */
export function generateRandomToken(bytes = 40): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Access Token generation via JWT.
 */
export function generateAccessToken(payload: Omit<JwtTokenPayload, 'tokenId'>): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256'
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

/**
 * Verify Access Token via JWT.
 */
export function verifyAccessToken(token: string): JwtTokenPayload {
  const options: VerifyOptions = {
    algorithms: ['HS256']
  };

  return jwt.verify(token, env.JWT_ACCESS_SECRET, options) as JwtTokenPayload;
}

// AES-256-GCM authenticated encryption for recovering rotation replacement tokens.
// This functionality has been removed as part of the MED-005 refactor.


