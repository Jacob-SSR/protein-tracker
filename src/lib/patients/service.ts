import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAudit } from '@/lib/audit'
import { hashPassword } from '@/lib/auth/password'
import { parseDateOnly, today } from '@/lib/date'
import { badRequest, conflict, notFound } from '@/lib/errors'
import { isPatientPortalEnabled } from '@/lib/settings'
import type { AccessTokenPayload } from '@/lib/auth/jwt'

export type CreatePatientInput = {
  hn: string
  fullName: string
  birthDate?: string | null
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null
  note?: string | null
  /** บันทึกน้ำหนักตั้งต้นไปพร้อมกันได้เลย จะได้คำนวณเป้าหมายทันที */
  weightKg?: number | null
  heightCm?: number | null
}

/**
 * สร้างผู้ป่วยโดย "ไม่มี" บัญชีเข้าระบบ
 * ระบบนี้เจ้าหน้าที่เป็นคนใช้ ผู้ป่วยไม่ต้องสมัคร
 * ถ้าจะเปิดสิทธิ์ให้ผู้ป่วยเข้าเองภายหลัง ใช้ grantPatientAccount()
 */
export async function createPatient(
  session: AccessTokenPayload,
  input: CreatePatientInput,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          hn: input.hn,
          fullName: input.fullName,
          birthDate: input.birthDate ? parseDateOnly(input.birthDate) : null,
          gender: input.gender ?? null,
          note: input.note ?? null,
        },
      })

      if (input.weightKg) {
        await tx.patientMeasurement.create({
          data: {
            patientId: patient.id,
            measuredOn: today(),
            weightKg: new Prisma.Decimal(input.weightKg),
            heightCm: input.heightCm ? new Prisma.Decimal(input.heightCm) : null,
            recordedById: session.userId,
          },
        })
      }

      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PATIENT_CREATE',
        targetType: 'Patient',
        targetId: patient.id,
        newValue: { hn: patient.hn, fullName: patient.fullName },
        ...meta,
      })

      return patient
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('DUPLICATE_HN', 'HN นี้มีอยู่ในระบบแล้ว')
    }
    throw error
  }
}

/** เปิดสิทธิ์ให้ผู้ป่วยล็อกอินเข้ามาดูข้อมูลตัวเอง — ทำได้เมื่อเปิด patient_portal_enabled เท่านั้น */
export async function grantPatientAccount(
  session: AccessTokenPayload,
  patientId: string,
  credentials: { username: string; password: string },
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  if (!(await isPatientPortalEnabled())) {
    throw badRequest(
      'PATIENT_PORTAL_DISABLED',
      'ยังไม่ได้เปิดใช้งานส่วนของผู้ป่วย เปิดได้ที่หน้าตั้งค่าระบบก่อน',
    )
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) throw notFound('ไม่พบผู้ป่วยรายนี้')
  if (patient.userId) throw conflict('ACCOUNT_EXISTS', 'ผู้ป่วยรายนี้มีบัญชีอยู่แล้ว')

  const passwordHash = await hashPassword(credentials.password)

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: credentials.username,
          fullName: patient.fullName,
          role: 'USER',
          passwordHash,
        },
      })
      await tx.patient.update({ where: { id: patientId }, data: { userId: user.id } })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PATIENT_ACCOUNT_GRANT',
        targetType: 'Patient',
        targetId: patientId,
        newValue: { username: user.username },
        ...meta,
      })
      return user
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('DUPLICATE_USERNAME', 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว')
    }
    throw error
  }
}

/** ปิดสิทธิ์เข้าระบบของผู้ป่วย — ปิดบัญชีไว้ ไม่ลบทิ้ง ประวัติที่เคยทำไว้ยังอ้างถึงได้ */
export async function revokePatientAccount(
  session: AccessTokenPayload,
  patientId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient?.userId) throw notFound('ผู้ป่วยรายนี้ไม่มีบัญชีเข้าระบบ')

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: patient.userId! }, data: { isActive: false } })
    await tx.patient.update({ where: { id: patientId }, data: { userId: null } })
    await writeAudit(tx, {
      actorId: session.userId,
      action: 'PATIENT_ACCOUNT_REVOKE',
      targetType: 'Patient',
      targetId: patientId,
      oldValue: { userId: patient.userId },
      ...meta,
    })
  })
}

/** เก็บผู้ป่วยเข้าคลัง — ไม่ลบข้อมูล แค่ซ่อนจากรายชื่อที่ใช้งานอยู่ กู้คืนได้ */
export async function archivePatient(
  session: AccessTokenPayload,
  patientId: string,
  isActive: boolean,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) throw notFound('ไม่พบผู้ป่วยรายนี้')

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({ where: { id: patientId }, data: { isActive } })
    await writeAudit(tx, {
      actorId: session.userId,
      action: isActive ? 'PATIENT_RESTORE' : 'PATIENT_ARCHIVE',
      targetType: 'Patient',
      targetId: patientId,
      oldValue: { isActive: patient.isActive },
      newValue: { isActive },
      ...meta,
    })
  })
}

/**
 * ลบผู้ป่วยถาวร — ใช้กับกรณีคีย์ผิดคน หรือคำขอลบข้อมูลส่วนบุคคลเท่านั้น
 * ก่อนลบจะ snapshot ข้อมูลทั้งก้อนลง AuditLog ไว้ก่อน เพราะหลังจากนี้กู้จากตารางหลักไม่ได้แล้ว
 * (MealItemHistory ไม่มี FK จึงยังอยู่ ใช้สอบย้อนหลังได้)
 */
export async function deletePatientPermanently(
  session: AccessTokenPayload,
  patientId: string,
  confirmHn: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      measurements: true,
      labs: true,
      comorbidities: { include: { comorbidity: true } },
      calculations: true,
      meals: { include: { items: true } },
    },
  })
  if (!patient) throw notFound('ไม่พบผู้ป่วยรายนี้')

  // กันลบผิดคน: ต้องพิมพ์ HN ให้ตรงก่อน
  if (confirmHn.trim() !== patient.hn) {
    throw badRequest('HN_MISMATCH', 'HN ที่พิมพ์ยืนยันไม่ตรงกับผู้ป่วยรายนี้')
  }

  const snapshot = {
    hn: patient.hn,
    fullName: patient.fullName,
    measurements: patient.measurements.length,
    labs: patient.labs.length,
    comorbidities: patient.comorbidities.map((row) => row.comorbidity.code),
    calculations: patient.calculations.length,
    meals: patient.meals.length,
    mealItems: patient.meals.reduce((sum, meal) => sum + meal.items.length, 0),
  }

  await prisma.$transaction(async (tx) => {
    // เขียน audit ก่อนลบ ถ้าเขียนไม่ผ่านก็จะไม่ลบอะไรเลย
    await writeAudit(tx, {
      actorId: session.userId,
      action: 'PATIENT_DELETE_PERMANENT',
      targetType: 'Patient',
      targetId: patientId,
      oldValue: snapshot,
      ...meta,
    })

    if (patient.userId) {
      await tx.patient.update({ where: { id: patientId }, data: { userId: null } })
      await tx.user.delete({ where: { id: patient.userId } })
    }
    await tx.patient.delete({ where: { id: patientId } })
  })

  return snapshot
}
