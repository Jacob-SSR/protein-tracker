import { Prisma, type Role } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAudit } from '@/lib/audit'
import { hashPassword } from '@/lib/auth/password'
import { conflict, forbidden } from '@/lib/errors'
import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { isSuperAdmin } from '@/lib/permissions'

/** ADMIN จัดการได้เฉพาะบัญชีผู้ป่วย — บัญชีระดับ admin ต้อง SUPER_ADMIN เท่านั้น */
export function assertCanManageRole(session: AccessTokenPayload, role: Role) {
  if (role !== 'USER' && !isSuperAdmin(session)) {
    throw forbidden('เฉพาะ SUPER_ADMIN เท่านั้นที่จัดการบัญชีระดับผู้ดูแลได้')
  }
}

export type CreateUserInput = {
  username: string
  password: string
  fullName: string
  email?: string | null
  role: Role
}

export async function createUser(
  session: AccessTokenPayload,
  input: CreateUserInput,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  assertCanManageRole(session, input.role)

  const passwordHash = await hashPassword(input.password)

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          email: input.email || null,
          fullName: input.fullName,
          role: input.role,
          passwordHash,
        },
      })

      await writeAudit(tx, {
        actorId: session.userId,
        action: 'USER_CREATE',
        targetType: 'User',
        targetId: user.id,
        newValue: { username: user.username, role: user.role },
        ...meta,
      })

      return user
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('DUPLICATE', 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้ไปแล้ว')
    }
    throw error
  }
}

export async function resetPassword(
  session: AccessTokenPayload,
  userId: string,
  newPassword: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  assertCanManageRole(session, target.role)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    })
    // ไม่เก็บรหัสผ่านเก่า/ใหม่ลง audit เด็ดขาด บันทึกแค่ว่าใครรีเซ็ตให้ใคร
    await writeAudit(tx, {
      actorId: session.userId,
      action: 'USER_PASSWORD_RESET',
      targetType: 'User',
      targetId: userId,
      ...meta,
    })
  })
}
