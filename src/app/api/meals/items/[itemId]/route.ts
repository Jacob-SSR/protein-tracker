import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta } from '@/lib/audit'
import { notFound } from '@/lib/errors'
import { canMutateMealOf } from '@/lib/permissions'
import { forbidden } from '@/lib/errors'
import { deleteMealItem, updateMealItem } from '@/lib/meals/service'
import { getDailySummary } from '@/lib/meals/summary'

type Params = { params: Promise<{ itemId: string }> }

const patchSchema = z.object({
  quantity: z.number().positive().max(1000),
  foodUnitId: z.string().min(1).optional(),
})

async function loadOwner(itemId: string) {
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    select: { meal: { select: { patientId: true, mealDate: true } } },
  })
  if (!item) throw notFound('ไม่พบรายการอาหาร')
  return item.meal
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession()
    const { itemId } = await params
    const meal = await loadOwner(itemId)
    if (!canMutateMealOf(session, meal.patientId)) throw forbidden()

    const body = patchSchema.parse(await request.json())
    await updateMealItem({
      mealItemId: itemId,
      quantity: body.quantity,
      foodUnitId: body.foodUnitId,
      patientId: meal.patientId,
      actorId: session.userId,
      ...requestMeta(request),
    })

    return ok({ summary: await getDailySummary(meal.patientId, meal.mealDate) })
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession()
    const { itemId } = await params
    const meal = await loadOwner(itemId)
    if (!canMutateMealOf(session, meal.patientId)) throw forbidden()

    await deleteMealItem({
      mealItemId: itemId,
      patientId: meal.patientId,
      actorId: session.userId,
      ...requestMeta(request),
    })

    return ok({ summary: await getDailySummary(meal.patientId, meal.mealDate) })
  })
}
