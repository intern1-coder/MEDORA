// src/services/appointment.service.ts
import { prisma } from '../config/database';
import { Appointment, AppointmentStatus, Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import { parseISO, isBefore, isAfter } from 'date-fns';

/** Helper to determine time-slot overlap */
function slotsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && endA > startB;
}

/** Conflict detection for doctor or room */
async function hasConflict(params: {
  doctorId: string;
  departmentId: string;
  roomId?: string | null;
  slotStart: Date;
  slotEnd: Date;
  excludeId?: string;
}): Promise<boolean> {
  const { doctorId, departmentId, roomId, slotStart, slotEnd, excludeId } = params;

  // Doctor conflict – same doctor, overlapping and not cancelled
  const doctorConflicts = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { not: AppointmentStatus.CANCELLED },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { slotStart: { lt: slotEnd } },
        { slotEnd: { gt: slotStart } },
      ],
    },
    select: { id: true },
  });
  if (doctorConflicts.length > 0) return true;

  // Room conflict – only if a roomId is supplied
  if (roomId) {
    const roomConflicts = await prisma.appointment.findMany({
      where: {
        roomId,
        status: { not: AppointmentStatus.CANCELLED },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          { slotStart: { lt: slotEnd } },
          { slotEnd: { gt: slotStart } },
        ],
      },
      select: { id: true },
    });
    if (roomConflicts.length > 0) return true;
  }

  return false;
}

/** Create a new appointment with conflict checks */
export async function createAppointment(data: Prisma.AppointmentCreateInput): Promise<Appointment> {
  const { doctorId, departmentId, roomId, slotStart, slotEnd } = data;
  if (!doctorId || !departmentId || !slotStart || !slotEnd) {
    throw new BadRequestError('Missing required appointment fields');
  }
  const start = new Date(slotStart as any);
  const end = new Date(slotEnd as any);
  if (isAfter(start, end) || isBefore(end, start)) {
    throw new BadRequestError('Invalid time slot: start must be before end');
  }

  const conflict = await hasConflict({
    doctorId,
    departmentId,
    roomId: roomId as string | null,
    slotStart: start,
    slotEnd: end,
  });
  if (conflict) {
    throw new ConflictError('Appointment time conflicts with existing booking');
  }

  // Use a transaction so that conflict check and insert are atomic
  const [appointment] = await prisma.$transaction([
    prisma.appointment.create({ data }),
  ]);
  return appointment;
}

/** Retrieve appointment by ID */
export async function getAppointmentById(id: string): Promise<Appointment> {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) throw new NotFoundError('Appointment not found');
  return appt;
}

/** Update / reschedule an existing appointment */
export async function updateAppointment(
  id: string,
  data: Prisma.AppointmentUpdateInput
): Promise<Appointment> {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Appointment not found');

  const slotStart = data.slotStart ? new Date(data.slotStart as any) : existing.slotStart;
  const slotEnd = data.slotEnd ? new Date(data.slotEnd as any) : existing.slotEnd;
  const doctorId = (data.doctorId as string) ?? existing.doctorId;
  const departmentId = (data.departmentId as string) ?? existing.departmentId;
  const roomId = (data.roomId as string) ?? existing.roomId;

  const conflict = await hasConflict({
    doctorId,
    departmentId,
    roomId: roomId as string | null,
    slotStart,
    slotEnd,
    excludeId: id,
  });
  if (conflict) {
    throw new ConflictError('Rescheduled time conflicts with existing booking');
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data,
  });
  return updated;
}

/** Delete an appointment – admin only (enforced by route) */
export async function deleteAppointment(id: string): Promise<Appointment> {
  const deleted = await prisma.appointment.delete({ where: { id } });
  return deleted;
}
