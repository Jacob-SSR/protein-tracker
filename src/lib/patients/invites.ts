import { createHash, randomInt } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAudit } from '@/lib/audit'
import { hashPassword } from '@/lib/auth/password'
import { badRequest, conflict, notFound } from '@/lib/errors'
import { isPatientPortalEnabled } from '@/lib/settings'
import type { AccessTokenPayload } from '@/lib/auth/jwt'

/**
 * รหัสเชิญให้ผู้ป่วยตั้งบัญชีเอง
 *
 * เจ้าหน้าที่กดสร้าง -> ระบบคืนรหัสให้ดูครั้งเดียว -> ผู้ป่วยเอาไปกรอกที่ /register
 * พร้อม HN ของตัวเอง แล้วตั้ง username/password เอง เจ้าหน้าที่ไม่เคยรู้รหัสผ่านผู้ป่วย
 *
 * ในฐานข้อมูลเก็บแค่ sha256 ของรหัส — หลุดไปก็เอาไปใช้ไม่ได้
 * ใช้ sha256 ไม่ใช่ bcrypt เพราะต้อง lookup ด้วยรหัสตรงๆ และตัวรหัสสุ่มมาแล้ว
 * ไม่ใช่รหัสที่คนตั้งเอง จึงไม่มีปัญหาเรื่อง dictionary attack
 */

/** ตัดตัวที่อ่านผิดกันบ่อยออก (0/O, 1/I/L) เพราะรหัสนี้ต้องอ่านให้ผู้ป่วยฟังทางโทรศัพท์ */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 12
const DEFAULT_EXPIRES_HOURS = 72
/** กันเดารหัส: ยิงพลาดเกินเท่านี้ใน 15 นาที จาก IP เดียว = ถูกตัดชั่วคราว */
const MAX_FAILED_ATTEMPTS = 10
const ATTEMPT_WINDOW_MINUTES = 15

export const INVITE_FAILED_ACTION = 'PATIENT_INVITE_REDEEM_FAILED'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}

/** โชว์เป็น XXXX-XXXX-XXXX ให้อ่านง่าย แต่ตอนเทียบตัดขีดออกเสมอ */
export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

export function normalizeCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function hashCode(code: string): string {
  return createHash('sha256').update(normalizeCode(code)).digest('hex')
}

export type InviteStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'

export function inviteStatus(invite: {
  usedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
}): InviteStatus {
  if (invite.usedAt) return 'USED'
  if (invite.revokedAt) return 'REVOKED'
  if (invite.expiresAt <= new Date()) return 'EXPIRED'
  return 'ACTIVE'
}

/**
 * สร้างรหัสใหม่ให้ผู้ป่วยหนึ่งราย — รหัสเก่าที่ยังไม่ถูกใช้จะถูกยกเลิกอัตโนมัติ
 * คืนรหัสตัวจริงกลับไปครั้งเดียว หลังจากนี้ไม่มีทางอ่านย้อนได้อีก
 */
export async function createPatientInvite(
  session: AccessTokenPayload,
  patientId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
  expiresInHours = DEFAULT_EXPIRES_HOURS,
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

  const code = generateCode()
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

  const invite = await prisma.$transaction(async (tx) => {
    // เหลือรหัสที่ใช้ได้ทีละใบเท่านั้น กันสับสนว่าใบไหนคือใบล่าสุด
    await tx.patientInvite.updateMany({
      where: { patientId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    const created = await tx.patientInvite.create({
      data: {
        patientId,
        codeHash: hashCode(code),
        expiresAt,
        createdById: session.userId,
      },
    })

    await writeAudit(tx, {
      actorId: session.userId,
      action: 'PATIENT_INVITE_CREATE',
      targetType: 'Patient',
      targetId: patientId,
      // ห้ามเขียนตัวรหัสลง audit เด็ดขาด
      newValue: { inviteId: created.id, expiresAt: expiresAt.toISOString() },
      ...meta,
    })

    return created
  })

  return { id: invite.id, code: formatCode(code), expiresAt }
}

export async function revokePatientInvite(
  session: AccessTokenPayload,
  patientId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const result = await prisma.patientInvite.updateMany({
    where: { patientId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count === 0) throw notFound('ไม่มีรหัสเชิญที่ยังใช้ได้ของผู้ป่วยรายนี้')

  await writeAudit(prisma, {
    actorId: session.userId,
    action: 'PATIENT_INVITE_REVOKE',
    targetType: 'Patient',
    targetId: patientId,
    newValue: { revoked: result.count },
    ...meta,
  })

  return { revoked: result.count }
}

/** รหัสที่ยังใช้ได้ของผู้ป่วยรายนี้ (ไม่มีตัวรหัส มีแต่สถานะ/วันหมดอายุ) */
export async function getActiveInvite(patientId: string) {
  const invite = await prisma.patientInvite.findFirst({
    where: { patientId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  return invite ? { id: invite.id, expiresAt: invite.expiresAt } : null
}

/**
 * นับความพยายามที่ล้มเหลวจาก IP เดียวกันใน AuditLog
 * ใช้ AuditLog เป็นที่นับเพราะมันอยู่บน DB — นับได้ข้าม instance ไม่เหมือนตัวแปรใน memory
 */
async function assertNotThrottled(ipAddress: string | null | undefined) {
  if (!ipAddress) return
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000)
  const failures = await prisma.auditLog.count({
    where: { action: INVITE_FAILED_ACTION, ipAddress, createdAt: { gte: since } },
  })
  if (failures >= MAX_FAILED_ATTEMPTS) {
    throw badRequest(
      'TOO_MANY_ATTEMPTS',
      `กรอกรหัสผิดหลายครั้งเกินไป กรุณารออีก ${ATTEMPT_WINDOW_MINUTES} นาทีแล้วลองใหม่`,
    )
  }
}

async function recordFailure(
  reason: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  await writeAudit(prisma, {
    actorId: null,
    action: INVITE_FAILED_ACTION,
    targetType: 'PatientInvite',
    newValue: { reason },
    ...meta,
  })
}

export type RedeemInput = {
  code: string
  /** HN ของตัวเอง — ชั้นที่สองกันคนที่ได้รหัสไปแต่ไม่ใช่เจ้าของ */
  hn: string
  username: string
  password: string
}

/**
 * ผู้ป่วยเอารหัสมาตั้งบัญชีเอง
 * ทุกกรณีที่ล้มเหลวคืนข้อความเดียวกัน ไม่บอกว่ารหัสมีจริงไหมหรือ HN ผิด
 */
export async function redeemPatientInvite(
  input: RedeemInput,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  if (!(await isPatientPortalEnabled())) {
    throw badRequest(
      'PATIENT_PORTAL_DISABLED',
      'ขณะนี้ยังไม่เปิดให้ผู้ป่วยเข้าใช้งานด้วยตนเอง กรุณาติดต่อเจ้าหน้าที่',
    )
  }

  await assertNotThrottled(meta.ipAddress)

  const invalid = badRequest(
    'INVALID_INVITE',
    'รหัสเชิญหรือ HN ไม่ถูกต้อง หรือรหัสหมดอายุแล้ว กรุณาติดต่อเจ้าหน้าที่',
  )

  const invite = await prisma.patientInvite.findUnique({
    where: { codeHash: hashCode(input.code) },
    include: { patient: true },
  })

  if (!invite || inviteStatus(invite) !== 'ACTIVE') {
    await recordFailure(invite ? inviteStatus(invite) : 'NOT_FOUND', meta)
    throw invalid
  }
  if (invite.patient.hn.trim().toLowerCase() !== input.hn.trim().toLowerCase()) {
    await recordFailure('HN_MISMATCH', meta)
    throw invalid
  }
  if (invite.patient.userId) {
    await recordFailure('ACCOUNT_EXISTS', meta)
    throw invalid
  }

  const passwordHash = await hashPassword(input.password)

  try {
    return await prisma.$transaction(async (tx) => {
      // ปิดรหัสก่อนสร้างบัญชี — ถ้ามีคนยิงพร้อมกัน จะมีแค่คนเดียวที่ผ่าน
      const claimed = await tx.patientInvite.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      })
      if (claimed.count === 0) throw invalid

      const user = await tx.user.create({
        data: {
          username: input.username,
          fullName: invite.patient.fullName,
          role: 'USER',
          passwordHash,
        },
      })

      await tx.patientInvite.update({
        where: { id: invite.id },
        data: { usedByUserId: user.id },
      })
      await tx.patient.update({
        where: { id: invite.patientId },
        data: { userId: user.id },
      })

      await writeAudit(tx, {
        actorId: user.id,
        action: 'PATIENT_INVITE_REDEEM',
        targetType: 'Patient',
        targetId: invite.patientId,
        newValue: { inviteId: invite.id, username: user.username },
        ...meta,
      })

      return { user, patientId: invite.patientId }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('DUPLICATE_USERNAME', 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว กรุณาตั้งชื่ออื่น')
    }
    throw error
  }
}
