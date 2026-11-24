// src/services/doctor.service.ts
import { prisma } from '../config/database';
import { DoctorProfile, Prisma, AppointmentStatus } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';

export async function listDoctors(params: {
  page?: number;
  limit?: number;
  departmentId?: string;
  specialization?: string;
  search?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.DoctorProfileWhereInput = {};

  if (params.specialization) {
    where.specialization = { contains: params.specialization, mode: 'insensitive' };
  }

  if (params.departmentId) {
    where.departments = {
      some: { departmentId: params.departmentId },
    };
  }

  if (params.search) {
    where.OR = [
      { specialization: { contains: params.search, mode: 'insensitive' } },
      { qualifications: { contains: params.search, mode: 'insensitive' } },
      { licenseNumber: { contains: params.search, mode: 'insensitive' } },
      { user: { email: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.doctorProfile.count({ where }),
    prisma.doctorProfile.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, email: true, status: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        schedules: {
          where: { isActive: true },
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

export async function getDoctorProfileById(id: string): Promise<DoctorProfile> {
  const doc = await prisma.doctorProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, status: true },
      },
      departments: {
        include: {
          department: true,
        },
      },
      schedules: {
        where: { isActive: true },
      },
      leaves: {
        where: { endDate: { gte: new Date() } },
      },
    },
  });

  if (!doc) {
    throw new NotFoundError('Doctor profile not found');
  }

  return doc;
}

export async function createDoctorProfile(data: {
  userId: string;
  licenseNumber: string;
  specialization: string;
  qualifications: string;
  consultationFee: number;
  defaultSlotMinutes?: number;
  roomNumber?: string;
  bio?: string;
  departmentIds: string[];
  primaryDepartmentId?: string;
}): Promise<DoctorProfile> {
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new NotFoundError('User account not found');
  if (user.role !== 'DOCTOR') throw new BadRequestError('User role must be DOCTOR');

  const existing = await prisma.doctorProfile.findFirst({
    where: {
      OR: [{ userId: data.userId }, { licenseNumber: data.licenseNumber }],
    },
  });
  if (existing) {
    throw new ConflictError('A doctor profile with this user or license number already exists');
  }

  return prisma.doctorProfile.create({
    data: {
      userId: data.userId,
      licenseNumber: data.licenseNumber,
      specialization: data.specialization,
      qualifications: data.qualifications,
      consultationFee: data.consultationFee,
      defaultSlotMinutes: data.defaultSlotMinutes || 15,
      roomNumber: data.roomNumber,
      bio: data.bio,
      departments: {
        create: data.departmentIds.map((depId) => ({
          departmentId: depId,
          isPrimary: depId === (data.primaryDepartmentId || data.departmentIds[0]),
        })),
      },
    },
    include: {
      departments: true,
      user: {
        select: { id: true, email: true, status: true },
      },
    },
  });
}

export async function updateDoctorProfile(
  id: string,
  data: {
    specialization?: string;
    qualifications?: string;
    consultationFee?: number;
    defaultSlotMinutes?: number;
    roomNumber?: string | null;
    bio?: string | null;
  }
): Promise<DoctorProfile> {
  await getDoctorProfileById(id);

  return prisma.doctorProfile.update({
    where: { id },
    data,
    include: {
      departments: true,
      user: {
        select: { id: true, email: true },
      },
    },
  });
}

export async function setDoctorSchedules(
  doctorId: string,
  schedules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>
) {
  await getDoctorProfileById(doctorId);

  return prisma.$transaction(async (tx) => {
    // Delete existing schedules and re-insert new template
    await tx.doctorSchedule.deleteMany({ where: { doctorId } });

    await tx.doctorSchedule.createMany({
      data: schedules.map((s) => ({
        doctorId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive ?? true,
      })),
    });

    return tx.doctorSchedule.findMany({ where: { doctorId } });
  });
}

export async function addDoctorLeave(
  doctorId: string,
  data: {
    startDate: string;
    endDate: string;
    reason?: string;
  }
) {
  await getDoctorProfileById(doctorId);

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  if (start.getTime() > end.getTime()) {
    throw new BadRequestError('Leave start date must be before or on end date');
  }

  return prisma.doctorLeave.create({
    data: {
      doctorId,
      startDate: start,
      endDate: end,
      reason: data.reason,
    },
  });
}

export async function getDoctorAvailableSlots(
  doctorId: string,
  dateStr: string
): Promise<Array<{ start: Date; end: Date; available: boolean }>> {
  const doctor = await getDoctorProfileById(doctorId);
  const queryDate = new Date(dateStr);
  if (isNaN(queryDate.getTime())) throw new BadRequestError('Invalid date format');

  const dayOfWeek = queryDate.getUTCDay();

  // 1. Check if doctor is on leave
  const isOnLeave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId,
      startDate: { lte: queryDate },
      endDate: { gte: queryDate },
    },
  });

  if (isOnLeave) {
    return [];
  }

  // 2. Fetch doctor schedule for the day
  const schedule = await prisma.doctorSchedule.findFirst({
    where: {
      doctorId,
      dayOfWeek,
      isActive: true,
    },
  });

  if (!schedule) {
    return [];
  }

  // 3. Generate slots
  const [startHour, startMin] = schedule.startTime.split(':').map(Number);
  const [endHour, endMin] = schedule.endTime.split(':').map(Number);

  const slotDurationMs = doctor.defaultSlotMinutes * 60 * 1000;

  const windowStart = new Date(queryDate);
  windowStart.setUTCHours(startHour, startMin, 0, 0);

  const windowEnd = new Date(queryDate);
  windowEnd.setUTCHours(endHour, endMin, 0, 0);

  // 4. Fetch existing booked appointments for the day
  const existingAppts = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION],
      },
      slotStart: { gte: windowStart, lt: windowEnd },
    },
    select: { slotStart: true, slotEnd: true },
  });

  const slots: Array<{ start: Date; end: Date; available: boolean }> = [];
  let currentStart = windowStart.getTime();

  while (currentStart + slotDurationMs <= windowEnd.getTime()) {
    const slotStart = new Date(currentStart);
    const slotEnd = new Date(currentStart + slotDurationMs);

    // Overlap condition
    const isBooked = existingAppts.some((appt) => {
      return slotStart < appt.slotEnd && slotEnd > appt.slotStart;
    });

    slots.push({
      start: slotStart,
      end: slotEnd,
      available: !isBooked,
    });

    currentStart += slotDurationMs;
  }

  return slots;
}
