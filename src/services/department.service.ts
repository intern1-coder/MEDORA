// src/services/department.service.ts
import { prisma } from '../config/database';
import { Department, Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';

export async function listDepartments(params: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const skip = (page - 1) * limit;

  const where: Prisma.DepartmentWhereInput = {
    deletedAt: null,
  };

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { code: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        doctors: {
          select: {
            id: true,
            isPrimary: true,
            doctor: {
              select: {
                id: true,
                specialization: true,
                licenseNumber: true,
                user: {
                  select: { id: true, email: true, status: true },
                },
              },
            },
          },
        },
      },
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

export async function getDepartmentById(id: string): Promise<Department> {
  const dept = await prisma.department.findFirst({
    where: { id, deletedAt: null },
    include: {
      doctors: {
        include: {
          doctor: {
            include: {
              user: {
                select: { id: true, email: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!dept) {
    throw new NotFoundError('Department not found');
  }

  return dept;
}

export async function createDepartment(data: {
  name: string;
  code: string;
  description?: string;
  roomNumbers?: string[];
  isActive?: boolean;
}): Promise<Department> {
  const existing = await prisma.department.findFirst({
    where: {
      OR: [
        { code: data.code.toUpperCase() },
        { name: data.name },
      ],
    },
  });

  if (existing) {
    throw new ConflictError('A department with this name or code already exists');
  }

  return prisma.department.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
      description: data.description,
      roomNumbers: data.roomNumbers || [],
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateDepartment(
  id: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    roomNumbers?: string[];
    isActive?: boolean;
  }
): Promise<Department> {
  await getDepartmentById(id);

  if (data.code || data.name) {
    const conflict = await prisma.department.findFirst({
      where: {
        id: { not: id },
        OR: [
          ...(data.code ? [{ code: data.code.toUpperCase() }] : []),
          ...(data.name ? [{ name: data.name }] : []),
        ],
      },
    });

    if (conflict) {
      throw new ConflictError('Another department with this name or code already exists');
    }
  }

  return prisma.department.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code ? data.code.toUpperCase() : undefined,
      description: data.description,
      roomNumbers: data.roomNumbers,
      isActive: data.isActive,
    },
  });
}

export async function deleteDepartment(id: string): Promise<Department> {
  await getDepartmentById(id);

  // Soft delete per REQ-HOSP-004
  return prisma.department.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });
}
