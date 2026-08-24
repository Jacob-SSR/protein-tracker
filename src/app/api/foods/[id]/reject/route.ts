import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { notFound } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) })

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const { reason } = bodySchema.parse(await request.json())

    const food = await prisma.food.findUnique({ where: { id } })
    if (!food) throw notFound('ไม่พบอาหารรายการนี้')

    await prisma.$transaction(async (tx) => {
      await tx.food.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectReason: reason,
          approvedById: null,
          approvedAt: null,
        },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'FOOD_REJECT',
        targetType: 'Food',
        targetId: id,
        oldValue: { status: food.status },
        newValue: { status: 'REJECTED', reason },
        ...requestMeta(request),
      })
    })

    return ok({ food: { id, status: 'REJECTED' } })
  })
}
