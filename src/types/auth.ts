import { Role, UserStatus } from '@prisma/client';

export interface JwtTokenPayload {
  userId: string;
  email: string;
  role: Role;
  status: UserStatus;
  tokenId?: string; // Refresh token record ID if applicable
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface UserAuthProfile {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
