import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { handle, ok } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { signAccessToken } from '@/lib/auth/jwt'
import { setSessionCookie } from '@/lib/auth/session'
import { redeemPatientInvite } from '@/lib/patients/invites'

const bodySchema = z
  .object({
    code: z.string().trim().min(4).max(40),
    hn: z.string().trim().min(1).max(50),
    username: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'ใช้ได้เฉพาะ a-z 0-9 . _ -'),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((body) => body.password === body.confirmPassword, {
    path: ['confirmPassword'],
    message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
  })

/**
 * ผู้ป่วยตั้งบัญชีเองด้วยรหัสเชิญที่เจ้าหน้าที่ออกให้ — endpoint สาธารณะตัวเดียวที่สร้าง User ได้
 * ตั้งบัญชีเสร็จล็อกอินให้เลย ผู้ป่วยไม่ต้องพิมพ์รหัสผ่านซ้ำอีกรอบ
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = bodySchema.parse(await request.json())
    const meta = requestMeta(request)

    const { user, patientId } = await redeemPatientInvite(
      { code: body.code, hn: body.hn, username: body.username, password: body.password },
      meta,
    )

    const token = await signAccessToken({ userId: user.id, role: user.role, patientId })
    await setSessionCookie(token)
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    return ok(
      {
        user: { id: user.id, username: user.username, fullName: user.fullName, patientId },
      },
      201,
    )
  })
}
