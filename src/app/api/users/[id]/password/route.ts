import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { resetPassword } from '@/lib/users/service'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({ password: z.string().min(8).max(72) })

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const { password } = bodySchema.parse(await request.json())

    await resetPassword(session, id, password, requestMeta(request))
    return ok({ success: true })
  })
}
