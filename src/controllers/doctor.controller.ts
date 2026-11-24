// src/controllers/doctor.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import {
  listDoctors,
  getDoctorProfileById,
  createDoctorProfile,
  updateDoctorProfile,
  setDoctorSchedules,
  addDoctorLeave,
  getDoctorAvailableSlots,
} from '../services/doctor.service';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { logAuditEvent } from '../utils/audit';

export async function listDoctorsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await listDoctors(req.query as any);
    sendSuccess(res, result.items, HTTP_STATUS.OK, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function getDoctorProfileController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doctor = await getDoctorProfileById(id);
    sendSuccess(res, doctor);
  } catch (err) {
    next(err);
  }
}

export async function createDoctorProfileController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const doctor = await createDoctorProfile(req.body);

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'DOCTOR_PROFILE_CREATED',
        entityName: 'DoctorProfile',
        entityId: doctor.id,
        payloadSummary: { licenseNumber: doctor.licenseNumber, specialization: doctor.specialization },
      });
    }

    sendSuccess(res, doctor, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function updateDoctorProfileController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Doctor can update own profile, Admin can update any
    if (req.user.role === Role.DOCTOR) {
      const currentDoctor = await getDoctorProfileById(id);
      if (currentDoctor.userId !== req.user.userId) {
        throw new ForbiddenError('You can only update your own doctor profile');
      }
    }

    const doctor = await updateDoctorProfile(id, req.body);
    sendSuccess(res, doctor);
  } catch (err) {
    next(err);
  }
}

export async function setDoctorScheduleController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (req.user.role === Role.DOCTOR) {
      const currentDoctor = await getDoctorProfileById(id);
      if (currentDoctor.userId !== req.user.userId) {
        throw new ForbiddenError('You can only update your own schedule');
      }
    }

    const schedules = await setDoctorSchedules(id, req.body.schedules);
    sendSuccess(res, schedules);
  } catch (err) {
    next(err);
  }
}

export async function addDoctorLeaveController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (req.user.role === Role.DOCTOR) {
      const currentDoctor = await getDoctorProfileById(id);
      if (currentDoctor.userId !== req.user.userId) {
        throw new ForbiddenError('You can only manage your own leave');
      }
    }

    const leave = await addDoctorLeave(id, req.body);
    sendSuccess(res, leave, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function getDoctorAvailableSlotsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const dateStr = req.query.date as string;
    const slots = await getDoctorAvailableSlots(id, dateStr);
    sendSuccess(res, slots);
  } catch (err) {
    next(err);
  }
}
