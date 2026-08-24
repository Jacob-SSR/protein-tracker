import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { ADMIN_ROLES } from '@/lib/permissions'

const querySchema = z.object({
  q: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: Request) {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const { searchParams } = new URL(request.url)
    const { q, take } = querySchema.parse(Object.fromEntries(searchParams))

    const patients = await prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { hn: { contains: q, mode: 'insensitive' } },
              { user: { fullName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        hn: true,
        isActive: true,
        user: { select: { fullName: true, username: true } },
      },
    })

    return ok({ patients })
  })
}
