import { handle, ok, requireSession } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { createPatientInvite, revokePatientInvite } from '@/lib/patients/invites'

type Params = { params: Promise<{ id: string }> }

/** สร้างรหัสเชิญ — response นี้คือที่เดียวที่ตัวรหัสจริงถูกส่งออก */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const invite = await createPatientInvite(session, id, requestMeta(request))
    return ok({ invite }, 201)
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const result = await revokePatientInvite(session, id, requestMeta(request))
    return ok(result)
  })
}
