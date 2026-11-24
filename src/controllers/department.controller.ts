// src/controllers/department.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../services/department.service';
import { logAuditEvent } from '../utils/audit';

export async function listDepartmentsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await listDepartments(req.query as any);
    sendSuccess(res, result.items, HTTP_STATUS.OK, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const department = await getDepartmentById(id);
    sendSuccess(res, department);
  } catch (err) {
    next(err);
  }
}

export async function createDepartmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const department = await createDepartment(req.body);

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'DEPARTMENT_CREATED',
        entityName: 'Department',
        entityId: department.id,
        payloadSummary: { code: department.code, name: department.name },
      });
    }

    sendSuccess(res, department, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function updateDepartmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const department = await updateDepartment(id, req.body);

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'DEPARTMENT_UPDATED',
        entityName: 'Department',
        entityId: department.id,
        payloadSummary: req.body,
      });
    }

    sendSuccess(res, department);
  } catch (err) {
    next(err);
  }
}

export async function deleteDepartmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const department = await deleteDepartment(id);

    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        action: 'DEPARTMENT_DELETED',
        entityName: 'Department',
        entityId: department.id,
        payloadSummary: { code: department.code },
      });
    }

    sendSuccess(res, department);
  } catch (err) {
    next(err);
  }
}
