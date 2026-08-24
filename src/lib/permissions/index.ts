import type { Role } from '@prisma/client'
import type { AccessTokenPayload } from '@/lib/auth/jwt'

/**
 * Authorization อย่างเดียว — "มึงมีสิทธิ์ทำอะไร"
 * ห้ามมี business logic (คำนวณโปรตีน/มื้ออาหาร) ในไฟล์นี้
 */

export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN']

export function isAdmin(session: AccessTokenPayload): boolean {
  return ADMIN_ROLES.includes(session.role)
}

export function isSuperAdmin(session: AccessTokenPayload): boolean {
  return session.role === 'SUPER_ADMIN'
}

export function hasRole(session: AccessTokenPayload, roles: Role[]): boolean {
  return roles.includes(session.role)
}

/** ผู้ป่วยเห็นได้เฉพาะข้อมูลตัวเอง, admin เห็นได้ทุกคน */
export function canAccessPatient(session: AccessTokenPayload, patientId: string): boolean {
  if (isAdmin(session)) return true
  return session.patientId === patientId
}

/** ผู้ป่วยแก้ได้เฉพาะรายการอาหารของตัวเอง */
export function canMutateMealOf(session: AccessTokenPayload, patientId: string): boolean {
  return canAccessPatient(session, patientId)
}

/** Audit log อ่านได้เฉพาะ role สูงสุด และไม่มีทางลบผ่าน API */
export function canReadAuditLog(session: AccessTokenPayload): boolean {
  return isSuperAdmin(session)
}
