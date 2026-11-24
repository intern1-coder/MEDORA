// src/services/appointment.service.ts
import { prisma } from '../config/database';
import { Appointment, AppointmentStatus, Prisma, Role } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';

/** Active statuses that block slots according to BR-APPT-003 */
const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_CONSULTATION,
];

/** Check conflict inside the transaction for both doctor and patient */
async function assertNoConflict(
  tx: Prisma.TransactionClient,
  params: {
    doctorId: string;
    patientId: string;
    slotStart: Date;
    slotEnd: Date;
    excludeId?: string;
  }
): Promise<void> {
  const { doctorId, patientId, slotStart, slotEnd, excludeId } = params;

  // 1. Doctor Conflict (BR-APPT-001)
  const doctorConflict = await tx.appointment.findFirst({
    where: {
      doctorId,
      status: { in: ACTIVE_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { slotStart: { lt: slotEnd } },
        { slotEnd: { gt: slotStart } },
      ],
    },
    select: { id: true },
  });

  if (doctorConflict) {
    throw new ConflictError('Doctor is not available during the requested time slot');
  }

  // 2. Patient Conflict (BR-APPT-002)
  const patientConflict = await tx.appointment.findFirst({
    where: {
      patientId,
      status: { in: ACTIVE_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { slotStart: { lt: slotEnd } },
        { slotEnd: { gt: slotStart } },
      ],
    },
    select: { id: true },
  });

  if (patientConflict) {
    throw new ConflictError('Patient already has an active appointment during the requested time window');
  }
}

/** Validate status transition based on approved role workflow */
function validateStatusTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus,
  userRole: Role
): void {
  if (currentStatus === targetStatus) return;

  // 1. Only HOSPITAL_ADMIN can reopen a COMPLETED appointment
  if (currentStatus === AppointmentStatus.COMPLETED) {
    if (userRole !== Role.HOSPITAL_ADMIN) {
      throw new ForbiddenError('Only a Hospital Admin can modify or reopen a COMPLETED appointment');
    }
    return;
  }

  // 2. Terminal state CANCELLED cannot transition further unless admin overrides
  if (currentStatus === AppointmentStatus.CANCELLED && userRole !== Role.HOSPITAL_ADMIN) {
    throw new BadRequestError('Cancelled appointments cannot be changed');
  }

  // 3. Role-specific permitted transitions
  if (userRole === Role.PATIENT) {
    if (targetStatus === AppointmentStatus.CANCELLED && currentStatus === AppointmentStatus.SCHEDULED) {
      return;
    }
    throw new ForbiddenError('Patients are only authorized to cancel their scheduled appointments');
  }

  if (userRole === Role.DOCTOR) {
    // Doctors move CHECKED_IN or SCHEDULED -> IN_CONSULTATION -> COMPLETED
    const allowedDoctorTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: [AppointmentStatus.IN_CONSULTATION, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      CHECKED_IN: [AppointmentStatus.IN_CONSULTATION, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      IN_CONSULTATION: [AppointmentStatus.COMPLETED],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };

    if (!allowedDoctorTransitions[currentStatus]?.includes(targetStatus)) {
      throw new BadRequestError(`Doctors cannot transition appointment from ${currentStatus} to ${targetStatus}`);
    }
    return;
  }

  if (userRole === Role.RECEPTIONIST) {
    // Receptionists manage check-ins, cancellations, no-shows
    const allowedReceptionistTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: [AppointmentStatus.CHECKED_IN, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      CHECKED_IN: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      IN_CONSULTATION: [],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };

    if (!allowedReceptionistTransitions[currentStatus]?.includes(targetStatus)) {
      throw new BadRequestError(`Receptionists cannot transition appointment from ${currentStatus} to ${targetStatus}`);
    }
    return;
  }

  // HOSPITAL_ADMIN has full governance over all transitions
  if (userRole === Role.HOSPITAL_ADMIN) {
    return;
  }

  throw new ForbiddenError('User role is not authorized to transition appointment status');
}

/** Query appointments with pagination, filtering, and role isolation */
export async function listAppointments(params: {
  page?: number;
  limit?: number;
  doctorId?: string;
  patientId?: string;
  departmentId?: string;
  status?: AppointmentStatus;
  startDate?: string;
  endDate?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.AppointmentWhereInput = {};

  if (params.doctorId) where.doctorId = params.doctorId;
  if (params.patientId) where.patientId = params.patientId;
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status;

  if (params.startDate || params.endDate) {
    where.slotStart = {};
    if (params.startDate) where.slotStart.gte = new Date(params.startDate);
    if (params.endDate) where.slotStart.lte = new Date(params.endDate);
  }

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { slotStart: 'desc' },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
            licenseNumber: true,
            user: {
              select: { email: true },
            },
          },
        },
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
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

/** Create a new appointment with Serializable transaction conflict checks */
export async function createAppointment(data: {
  patientId: string;
  doctorId: string;
  departmentId: string;
  slotStart: string | Date;
  slotEnd: string | Date;
  status?: AppointmentStatus;
  cancellationReason?: string;
}): Promise<Appointment> {
  const { doctorId, patientId, departmentId, status, cancellationReason } = data;
  if (!doctorId || !patientId || !departmentId || !data.slotStart || !data.slotEnd) {
    throw new BadRequestError('Missing required appointment fields: doctorId, patientId, departmentId, slotStart, slotEnd');
  }

  const start = new Date(data.slotStart);
  const end = new Date(data.slotEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestError('Invalid slotStart or slotEnd timestamp');
  }

  if (start.getTime() >= end.getTime()) {
    throw new BadRequestError('Invalid time slot: slotStart must be before slotEnd');
  }

  // BR-APPT-005: Appointments cannot be booked for historical timestamps
  if (start.getTime() < Date.now()) {
    throw new BadRequestError('Cannot book an appointment in the past (BR-APPT-005)');
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertNoConflict(tx, {
          doctorId,
          patientId,
          slotStart: start,
          slotEnd: end,
        });

        return tx.appointment.create({
          data: {
            doctorId,
            patientId,
            departmentId,
            slotStart: start,
            slotEnd: end,
            status: status || AppointmentStatus.SCHEDULED,
            cancellationReason,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );
  } catch (error: any) {
    if (error?.code === 'P2034' || error?.message?.includes('could not serialize access')) {
      throw new ConflictError('Appointment time conflicts with a concurrent booking. Please retry.');
    }
    throw error;
  }
}

/** Retrieve appointment by ID */
export async function getAppointmentById(id: string): Promise<Appointment> {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: true,
      patient: true,
      department: true,
    },
  });
  if (!appt) throw new NotFoundError('Appointment not found');
  return appt;
}

/** Update / reschedule an existing appointment */
export async function updateAppointment(
  id: string,
  data: {
    doctorId?: string;
    patientId?: string;
    departmentId?: string;
    slotStart?: string | Date;
    slotEnd?: string | Date;
    status?: AppointmentStatus;
    cancellationReason?: string;
  },
  userContext: { userId: string; role: Role }
): Promise<Appointment> {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Appointment not found');

  // Verify status transition permissions if status is being updated
  if (data.status && data.status !== existing.status) {
    validateStatusTransition(existing.status, data.status, userContext.role);

    // If cancelling, check BR-APPT-006 (1-hour notice for patients)
    if (data.status === AppointmentStatus.CANCELLED && userContext.role === Role.PATIENT) {
      const msUntilSlot = existing.slotStart.getTime() - Date.now();
      const minutesUntilSlot = msUntilSlot / (1000 * 60);
      if (minutesUntilSlot < 60) {
        throw new BadRequestError('Patients can only cancel appointments at least 1 hour in advance (BR-APPT-006)');
      }
    }
  }

  const slotStart = data.slotStart ? new Date(data.slotStart) : existing.slotStart;
  const slotEnd = data.slotEnd ? new Date(data.slotEnd) : existing.slotEnd;
  const doctorId = data.doctorId ?? existing.doctorId;
  const patientId = data.patientId ?? existing.patientId;
  const departmentId = data.departmentId ?? existing.departmentId;

  if (slotStart.getTime() >= slotEnd.getTime()) {
    throw new BadRequestError('Invalid time slot: slotStart must be before slotEnd');
  }

  const timeChanged = slotStart.getTime() !== existing.slotStart.getTime() || slotEnd.getTime() !== existing.slotEnd.getTime();
  if (timeChanged && slotStart.getTime() < Date.now() && userContext.role !== Role.HOSPITAL_ADMIN) {
    throw new BadRequestError('Cannot reschedule an appointment to a past time (BR-APPT-005)');
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        if (timeChanged || doctorId !== existing.doctorId || patientId !== existing.patientId) {
          await assertNoConflict(tx, {
            doctorId,
            patientId,
            slotStart,
            slotEnd,
            excludeId: id,
          });
        }

        return tx.appointment.update({
          where: { id },
          data: {
            doctorId,
            patientId,
            departmentId,
            slotStart,
            slotEnd,
            status: data.status ?? existing.status,
            cancellationReason: data.cancellationReason ?? existing.cancellationReason,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );
  } catch (error: any) {
    if (error?.code === 'P2034' || error?.message?.includes('could not serialize access')) {
      throw new ConflictError('Rescheduled time conflicts with a concurrent booking. Please retry.');
    }
    throw error;
  }
}

/** Cancel an appointment (soft cancellation, never hard deletion) */
export async function cancelAppointment(
  id: string,
  userContext: { userId: string; role: Role },
  cancellationReason?: string
): Promise<Appointment> {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Appointment not found');

  validateStatusTransition(existing.status, AppointmentStatus.CANCELLED, userContext.role);

  if (userContext.role === Role.PATIENT) {
    const msUntilSlot = existing.slotStart.getTime() - Date.now();
    const minutesUntilSlot = msUntilSlot / (1000 * 60);
    if (minutesUntilSlot < 60) {
      throw new BadRequestError('Patients can only cancel appointments at least 1 hour in advance (BR-APPT-006)');
    }
  }

  return prisma.appointment.update({
    where: { id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancellationReason: cancellationReason || 'Cancelled by user',
    },
  });
}
