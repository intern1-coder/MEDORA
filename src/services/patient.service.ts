// src/services/patient.service.ts
import { prisma } from '../config/database';
import { Patient, Prisma, BloodGroup, Gender } from '@prisma/client';
import { ConflictError, NotFoundError } from '../errors/AppError';

/** Helper to generate next MRN in atomic transaction (MED-YYYY-XXXXX) */
async function generateNextMRN(tx: Prisma.TransactionClient): Promise<string> {
  const currentYear = new Date().getFullYear();

  const seq = await tx.mRNSequence.upsert({
    where: { year: currentYear },
    update: { currentValue: { increment: 1 } },
    create: { year: currentYear, currentValue: 1 },
  });

  const padded = String(seq.currentValue).padStart(5, '0');
  return `MED-${currentYear}-${padded}`;
}

export async function listPatients(params: {
  page?: number;
  limit?: number;
  search?: string;
  mrn?: string;
  phone?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PatientWhereInput = {
    deletedAt: null,
  };

  if (params.mrn) {
    where.mrn = { equals: params.mrn.trim() };
  }

  if (params.phone) {
    where.phone = { contains: params.phone.trim() };
  }

  if (params.search) {
    const term = params.search.trim();
    where.OR = [
      { mrn: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        phone: true,
        email: true,
        bloodGroup: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
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

export async function getPatientById(id: string): Promise<Patient> {
  const patient = await prisma.patient.findFirst({
    where: { id, deletedAt: null },
    include: {
      medicalDocuments: {
        select: {
          id: true,
          fileName: true,
          documentType: true,
          mimeType: true,
          fileSizeBytes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  return patient;
}

export async function registerPatient(data: {
  firstName: string;
  lastName: string;
  dob: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  bloodGroup?: BloodGroup;
  allergies?: string[];
  existingConditions?: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  userId?: string;
}): Promise<Patient> {
  if (data.userId) {
    const existingPatientForUser = await prisma.patient.findUnique({
      where: { userId: data.userId },
    });
    if (existingPatientForUser) {
      throw new ConflictError('A patient profile is already associated with this user account');
    }
  }

  return prisma.$transaction(async (tx) => {
    const mrn = await generateNextMRN(tx);

    return tx.patient.create({
      data: {
        mrn,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: new Date(data.dob),
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        address: data.address,
        bloodGroup: data.bloodGroup || BloodGroup.UNKNOWN,
        allergies: data.allergies || [],
        existingConditions: data.existingConditions || [],
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        userId: data.userId,
      },
    });
  });
}

export async function updatePatient(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    gender?: Gender;
    phone?: string;
    email?: string;
    address?: string;
    bloodGroup?: BloodGroup;
    allergies?: string[];
    existingConditions?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }
): Promise<Patient> {
  await getPatientById(id);

  return prisma.patient.update({
    where: { id },
    data: {
      ...data,
      dob: data.dob ? new Date(data.dob) : undefined,
    },
  });
}
