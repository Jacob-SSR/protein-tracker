import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { grantPatientAccount, revokePatientAccount } from '@/lib/patients/service'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'ใช้ได้เฉพาะ a-z 0-9 . _ -'),
  password: z.string().min(8).max(72),
})

/** เปิดสิทธิ์ให้ผู้ป่วยล็อกอินเองได้ (ต้องเปิด patient_portal_enabled ก่อน) */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const body = bodySchema.parse(await request.json())

    const user = await grantPatientAccount(session, id, body, requestMeta(request))
    return ok({ account: { username: user.username } }, 201)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await revokePatientAccount(session, id, requestMeta(request))
    return ok({ success: true })
  })
}
