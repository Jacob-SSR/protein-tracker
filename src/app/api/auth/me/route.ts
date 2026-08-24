import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { notFound } from '@/lib/errors'

export async function GET() {
  return handle(async () => {
    const session = await requireSession()
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        patient: { select: { id: true, hn: true } },
      },
    })
    if (!user) throw notFound('ไม่พบผู้ใช้')
    return ok({ user })
  })
}
