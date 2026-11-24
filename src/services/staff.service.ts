// src/services/staff.service.ts
import { prisma } from '../config/database';
import { Role, User, UserStatus, Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import { hashPassword } from '../utils/security';

export async function listStaff(params: {
  page?: number;
  limit?: number;
  role?: Role;
  status?: UserStatus;
  search?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    role: { in: [Role.RECEPTIONIST, Role.DOCTOR, Role.HOSPITAL_ADMIN] },
  };

  if (params.role) where.role = params.role;
  if (params.status) where.status = params.status;
  if (params.search) {
    where.email = { contains: params.search, mode: 'insensitive' };
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            id: true,
            licenseNumber: true,
            specialization: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createStaffUser(data: {
  email: string;
  password: string;
  role: Role;
}) {
  if (data.role === Role.PATIENT) {
    throw new BadRequestError('Cannot create PATIENT role through staff management endpoint');
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateStaffStatus(userId: string, status: UserStatus) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  if (user.role === Role.PATIENT) {
    throw new BadRequestError('Cannot modify PATIENT role status via staff management');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      status,
      // If suspended or made inactive, instantly revoke access tokens
      tokenInvalidBefore: status !== UserStatus.ACTIVE ? new Date() : undefined,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });
}
