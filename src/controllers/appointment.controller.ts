// src/controllers/appointment.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import { Role } from '@prisma/client';
import {
  createAppointment,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  listAppointments,
} from '../services/appointment.service';
import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../errors/AppError';
import { logAuditEvent } from '../utils/audit';

/** Helper: resolve Patient ID associated with user account */
async function resolvePatientIdForUser(userId: string): Promise<string> {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!patient) {
    throw new NotFoundError('No patient profile is associated with this user account');
  }
  return patient.id;
}

/** Helper: resolve Doctor ID associated with user account */
async function resolveDoctorIdForUser(userId: string): Promise<string> {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!doctor) {
    throw new NotFoundError('No doctor profile is associated with this user account');
  }
  return doctor.id;
}

export async function listAppointmentsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const query = req.query as any;
    let patientId = query.patientId;
    let doctorId = query.doctorId;

    // Data isolation based on role
    if (req.user.role === Role.PATIENT) {
      patientId = await resolvePatientIdForUser(req.user.userId);
    } else if (req.user.role === Role.DOCTOR && !query.all) {
      // By default doctor sees their own appointments unless staff filter
      try {
        doctorId = await resolveDoctorIdForUser(req.user.userId);
      } catch {
        // Fallback if profile not found
      }
    }

    const result = await listAppointments({
      ...query,
      patientId,
      doctorId,
    });

    sendSuccess(res, result.items, HTTP_STATUS.OK, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function createAppointmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    let patientId = req.body.patientId;

    if (req.user.role === Role.PATIENT) {
      patientId = await resolvePatientIdForUser(req.user.userId);
    } else if (!patientId) {
      throw new ForbiddenError('Staff must provide patientId when creating an appointment');
    }

    const appointment = await createAppointment({
      ...req.body,
      patientId,
    });

    await logAuditEvent({
      actorUserId: req.user.userId,
      actorRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      action: 'APPOINTMENT_CREATED',
      entityName: 'Appointment',
      entityId: appointment.id,
      payloadSummary: {
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        slotStart: appointment.slotStart,
      },
    });

    sendSuccess(res, appointment, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function getAppointmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const appointment = await getAppointmentById(id);

    if (req.user.role === Role.PATIENT) {
      const patientId = await resolvePatientIdForUser(req.user.userId);
      if (appointment.patientId !== patientId) {
        throw new ForbiddenError('Access denied. You can only view your own appointments');
      }
    }

    sendSuccess(res, appointment);
  } catch (err) {
    next(err);
  }
}

export async function updateAppointmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (req.user.role === Role.PATIENT) {
      const patientId = await resolvePatientIdForUser(req.user.userId);
      const existing = await getAppointmentById(id);
      if (existing.patientId !== patientId) {
        throw new ForbiddenError('Access denied. You can only modify your own appointments');
      }
    }

    const appointment = await updateAppointment(
      id,
      req.body,
      { userId: req.user.userId, role: req.user.role }
    );

    await logAuditEvent({
      actorUserId: req.user.userId,
      actorRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      action: 'APPOINTMENT_UPDATED',
      entityName: 'Appointment',
      entityId: appointment.id,
      payloadSummary: {
        status: appointment.status,
        slotStart: appointment.slotStart,
      },
    });

    sendSuccess(res, appointment);
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (req.user.role === Role.PATIENT) {
      const patientId = await resolvePatientIdForUser(req.user.userId);
      const existing = await getAppointmentById(id);
      if (existing.patientId !== patientId) {
        throw new ForbiddenError('Access denied. You can only cancel your own appointments');
      }
    }

    const appointment = await cancelAppointment(
      id,
      { userId: req.user.userId, role: req.user.role },
      req.body.cancellationReason
    );

    await logAuditEvent({
      actorUserId: req.user.userId,
      actorRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      action: 'APPOINTMENT_CANCELLED',
      entityName: 'Appointment',
      entityId: appointment.id,
      payloadSummary: {
        cancellationReason: appointment.cancellationReason,
      },
    });

    sendSuccess(res, appointment);
  } catch (err) {
    next(err);
  }
}
