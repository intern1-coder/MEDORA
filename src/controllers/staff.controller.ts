// src/controllers/staff.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import { listStaff, createStaffUser, updateStaffStatus } from '../services/staff.service';
import { logAuditEvent } from '../utils/audit';

export async function listStaffController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await listStaff(req.query as any);
    sendSuccess(res, result.items, HTTP_STATUS.OK, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function createStaffUserController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await createStaffUser(req.body);

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'STAFF_USER_CREATED',
        entityName: 'User',
        entityId: user.id,
        payloadSummary: { email: user.email, role: user.role },
      });
    }

    sendSuccess(res, user, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function updateStaffStatusController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await updateStaffStatus(id, req.body.status);

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'STAFF_STATUS_UPDATED',
        entityName: 'User',
        entityId: user.id,
        payloadSummary: { status: user.status },
      });
    }

    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
