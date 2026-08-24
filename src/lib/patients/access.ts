import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { canAccessPatient } from '@/lib/permissions'
import { forbidden, notFound } from '@/lib/errors'
import { prisma } from '@/lib/db/prisma'

/** ใช้ทุก route ที่รับ patientId จาก URL — กันผู้ป่วยเปิดดูข้อมูลคนอื่นด้วยการเดา id */
export async function requirePatientAccess(session: AccessTokenPayload, patientId: string) {
  if (!canAccessPatient(session, patientId)) throw forbidden()
  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) throw notFound('ไม่พบผู้ป่วยรายนี้')
  return patient
}

/** ผู้ป่วยที่ล็อกอินอยู่ (role USER เท่านั้น) */
export function requireOwnPatientId(session: AccessTokenPayload): string {
  if (session.role !== 'USER' || !session.patientId) throw forbidden('บัญชีนี้ไม่ใช่บัญชีผู้ป่วย')
  return session.patientId
}

/**
 * หา patientId ที่ request นี้ต้องการ:
 * - ผู้ป่วย: ของตัวเองเสมอ (ignore query param เพื่อกันสวมรอย)
 * - admin: ต้องส่ง ?patientId= มา
 */
export async function resolveTargetPatientId(
  session: AccessTokenPayload,
  patientIdParam: string | null,
) {
  if (session.role === 'USER') return requireOwnPatientId(session)
  if (!patientIdParam) throw forbidden('ต้องระบุ patientId')
  await requirePatientAccess(session, patientIdParam)
  return patientIdParam
}
