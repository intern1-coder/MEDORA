// src/controllers/appointment.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import {
  createAppointment,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
} from '../services/appointment.service';

export async function createAppointmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const appointment = await createAppointment(req.body);
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
    const { id } = req.params;
    const appointment = await getAppointmentById(id);
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
    const { id } = req.params;
    const appointment = await updateAppointment(id, req.body);
    sendSuccess(res, appointment);
  } catch (err) {
    next(err);
  }
}

export async function deleteAppointmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const appointment = await deleteAppointment(id);
    sendSuccess(res, appointment);
  } catch (err) {
    next(err);
  }
}
