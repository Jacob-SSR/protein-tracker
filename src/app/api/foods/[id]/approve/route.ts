import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { badRequest, notFound } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params

    const food = await prisma.food.findUnique({ where: { id } })
    if (!food) throw notFound('ไม่พบอาหารรายการนี้')
    if (food.status === 'ACTIVE') throw badRequest('ALREADY_ACTIVE', 'อาหารรายการนี้อนุมัติแล้ว')

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.food.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          approvedById: session.userId,
          approvedAt: new Date(),
          rejectReason: null,
        },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'FOOD_APPROVE',
        targetType: 'Food',
        targetId: id,
        oldValue: { status: food.status },
        newValue: { status: row.status },
        ...requestMeta(request),
      })
      return row
    })

    return ok({ food: { id: updated.id, status: updated.status } })
  })
}
