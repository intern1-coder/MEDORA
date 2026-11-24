// src/controllers/patient.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import {
  listPatients,
  getPatientById,
  registerPatient,
  updatePatient,
} from '../services/patient.service';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { logAuditEvent } from '../utils/audit';

export async function listPatientsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await listPatients(req.query as any);
    sendSuccess(res, result.items, HTTP_STATUS.OK, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function getPatientProfileController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const patient = await getPatientById(id);

    // Patient can only view their own profile
    if (req.user.role === Role.PATIENT && patient.userId !== req.user.userId) {
      throw new ForbiddenError('Access denied. You can only view your own patient profile');
    }

    sendSuccess(res, patient);
  } catch (err) {
    next(err);
  }
}

export async function registerPatientController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let userId = req.body.userId;

    // If registered by self (PATIENT)
    if (req.user?.role === Role.PATIENT) {
      userId = req.user.userId;
    }

    const patient = await registerPatient({
      ...req.body,
      userId,
    });

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'PATIENT_REGISTERED',
        entityName: 'Patient',
        entityId: patient.id,
        payloadSummary: { mrn: patient.mrn, name: `${patient.firstName} ${patient.lastName}` },
      });
    }

    sendSuccess(res, patient, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function updatePatientProfileController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (req.user.role === Role.PATIENT) {
      const existing = await getPatientById(id);
      if (existing.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied. You can only update your own patient profile');
      }
    }

    const patient = await updatePatient(id, req.body);

    await logAuditEvent({
      actorUserId: req.user.userId,
      actorRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      action: 'PATIENT_UPDATED',
      entityName: 'Patient',
      entityId: patient.id,
      payloadSummary: req.body,
    });

    sendSuccess(res, patient);
  } catch (err) {
    next(err);
  }
}
