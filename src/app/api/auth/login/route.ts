import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { handle, ok } from '@/lib/api'
import { requestMeta, writeAudit } from '@/lib/audit'
import { signAccessToken } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'
import { setSessionCookie } from '@/lib/auth/session'
import { AppError } from '@/lib/errors'

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { username, password } = bodySchema.parse(await request.json())

    const user = await prisma.user.findUnique({
      where: { username },
      include: { patient: { select: { id: true } } },
    })

    // ข้อความเดียวกันทุกกรณี ไม่บอกว่า username มีอยู่จริงหรือไม่
    const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    if (!user || !user.isActive) throw invalid
    if (!(await verifyPassword(password, user.passwordHash))) throw invalid

    const token = await signAccessToken({
      userId: user.id,
      role: user.role,
      patientId: user.patient?.id,
    })
    await setSessionCookie(token)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await writeAudit(prisma, {
      actorId: user.id,
      action: 'AUTH_LOGIN',
      targetType: 'User',
      targetId: user.id,
      ...requestMeta(request),
    })

    return ok({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        patientId: user.patient?.id ?? null,
      },
    })
  })
}
