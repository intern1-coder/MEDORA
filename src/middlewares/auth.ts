import { Request, Response, NextFunction } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { verifyAccessToken } from '../utils/security';
import { JwtTokenPayload } from '../types/auth';
import { Permission, ROLE_PERMISSIONS } from '../constants/roles';
import { prisma } from '../config/database';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtTokenPayload;
    }
  }
}

/**
 * Middleware: Verify Bearer JWT token in Authorization header.
 * Enforces:
 * 1. Cryptographic signature and expiration.
 * 2. Token payload status checks (SUSPENDED / INACTIVE).
 * 3. Database synchronization check (verifying user's current status, role, and tokenInvalidBefore against iat).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new UnauthorizedError('Authentication token is required'));
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Invalid authorization header format. Format: Bearer <token>'));
  }

  let payload: JwtTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token has expired'));
    }
    return next(new UnauthorizedError('Invalid authentication token'));
  }

  // Fast pre-check on token payload claims
  if (payload.status === UserStatus.SUSPENDED) {
    return next(new ForbiddenError('User account is suspended'));
  }

  if (payload.status === UserStatus.INACTIVE) {
    return next(new ForbiddenError('User account is inactive'));
  }

  try {
    // Database synchronization: check current live user status, role, and tokenInvalidBefore
    const liveUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        status: true,
        tokenInvalidBefore: true
      }
    });

    if (!liveUser) {
      return next(new UnauthorizedError('User account no longer exists'));
    }

    if (liveUser.status === UserStatus.SUSPENDED) {
      return next(new ForbiddenError('User account is suspended'));
    }

    if (liveUser.status === UserStatus.INACTIVE) {
      return next(new ForbiddenError('User account is inactive'));
    }

    // Verify token issued-at against emergency invalidation timestamp
    if (liveUser.tokenInvalidBefore && payload.iat) {
      // iat is in seconds, tokenInvalidBefore is in milliseconds
      const tokenIatMs = payload.iat * 1000;
      const invalidBeforeMs = liveUser.tokenInvalidBefore.getTime();
      // If token was issued before the revocation threshold
      if (tokenIatMs < invalidBeforeMs) {
        return next(new UnauthorizedError('Token has been revoked'));
      }
    }

    // Bind synchronized live role and status to request context
    req.user = {
      ...payload,
      role: liveUser.role,
      status: liveUser.status
    };

    next();
  } catch (dbError) {
    // Pass unexpected internal/database errors to error handler
    next(dbError);
  }
}

/**
 * Middleware: Authorize specific allowed roles.
 */
export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(`Access denied. Role '${req.user.role}' is not authorized for this resource`)
      );
    }

    next();
  };
}

/**
 * Middleware: Authorize by granular permission.
 */
export function authorizePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    if (!userPermissions.includes(permission)) {
      return next(
        new ForbiddenError(`Access denied. Missing required permission: ${permission}`)
      );
    }

    next();
  };
}

/**
 * Middleware: Resource ownership check.
 * Allows access if:
 * 1. User's role is HOSPITAL_ADMIN, OR
 * 2. User's ID matches the resource owner specified in req.params[paramName].
 */
export function authorizeOwnerOrAdmin(paramName = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role === Role.HOSPITAL_ADMIN) {
      return next();
    }

    const targetUserId = req.params[paramName];
    if (req.user.userId !== targetUserId) {
      return next(new ForbiddenError('Access denied. You can only access your own resource'));
    }

    next();
  };
}
