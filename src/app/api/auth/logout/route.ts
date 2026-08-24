import { handle, ok } from '@/lib/api'
import { clearSessionCookie, getSession } from '@/lib/auth/session'
import { requestMeta, writeAudit } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: Request) {
  return handle(async () => {
    const session = await getSession()
    await clearSessionCookie()
    if (session) {
      await writeAudit(prisma, {
        actorId: session.userId,
        action: 'AUTH_LOGOUT',
        targetType: 'User',
        targetId: session.userId,
        ...requestMeta(request),
      })
    }
    return ok({ success: true })
  })
}
