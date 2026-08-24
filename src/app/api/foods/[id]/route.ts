import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { num, toDecimal } from '@/lib/decimal'
import { ADMIN_ROLES } from '@/lib/permissions'
import { badRequest, notFound } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'ARCHIVED']).optional(),
  units: z
    .array(
      z.object({
        /** มี id = แก้หน่วยเดิม, ไม่มี = เพิ่มหน่วยใหม่ */
        id: z.string().optional(),
        unitName: z.string().trim().min(1).max(50),
        gramsPerUnit: z.number().positive().optional(),
        proteinAmount: z.number().min(0),
        isDefault: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(10),
})

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const { id } = await params
    const food = await prisma.food.findUnique({
      where: { id },
      include: { units: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!food) throw notFound('ไม่พบอาหารรายการนี้')

    return ok({
      food: {
        ...food,
        units: food.units.map((unit) => ({
          ...unit,
          gramsPerUnit: unit.gramsPerUnit ? num(unit.gramsPerUnit) : null,
          proteinAmount: num(unit.proteinAmount),
        })),
      },
    })
  })
}

/**
 * แก้ค่าโปรตีนของหน่วยได้ ไม่กระทบรายการที่ผู้ป่วยบันทึกไปแล้ว
 * เพราะ MealItem เก็บ proteinAmount เป็น snapshot ของตัวเอง
 */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const body = patchSchema.parse(await request.json())

    const existing = await prisma.food.findUnique({
      where: { id },
      include: { units: true },
    })
    if (!existing) throw notFound('ไม่พบอาหารรายการนี้')

    if (body.units.filter((unit) => unit.isDefault).length > 1) {
      throw badRequest('MULTIPLE_DEFAULT_UNITS', 'ตั้งหน่วยหลักได้หน่วยเดียว')
    }

    const keptIds = new Set(body.units.map((unit) => unit.id).filter(Boolean) as string[])
    const removed = existing.units.filter((unit) => !keptIds.has(unit.id))

    if (removed.length > 0) {
      const used = await prisma.mealItem.findMany({
        where: { foodUnitId: { in: removed.map((unit) => unit.id) } },
        select: { foodUnitId: true },
        distinct: ['foodUnitId'],
      })
      if (used.length > 0) {
        const names = removed
          .filter((unit) => used.some((item) => item.foodUnitId === unit.id))
          .map((unit) => unit.unitName)
          .join(', ')
        throw badRequest(
          'UNIT_IN_USE',
          `ลบหน่วย "${names}" ไม่ได้ เพราะมีผู้ป่วยบันทึกอาหารด้วยหน่วยนี้ไปแล้ว`,
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      if (removed.length > 0) {
        await tx.foodUnit.deleteMany({
          where: { id: { in: removed.map((unit) => unit.id) } },
        })
      }

      for (const [index, unit] of body.units.entries()) {
        const data = {
          unitName: unit.unitName,
          gramsPerUnit: unit.gramsPerUnit ? toDecimal(unit.gramsPerUnit) : null,
          proteinAmount: toDecimal(unit.proteinAmount),
          isDefault: unit.isDefault ?? index === 0,
          sortOrder: index,
        }
        if (unit.id) {
          await tx.foodUnit.update({ where: { id: unit.id }, data })
        } else {
          await tx.foodUnit.create({ data: { ...data, foodId: id } })
        }
      }

      await tx.food.update({
        where: { id },
        data: {
          name: body.name,
          category: body.category || null,
          description: body.description || null,
          status: body.status ?? existing.status,
        },
      })

      await writeAudit(tx, {
        actorId: session.userId,
        action: 'FOOD_UPDATE',
        targetType: 'Food',
        targetId: id,
        oldValue: {
          name: existing.name,
          status: existing.status,
          units: existing.units.map((unit) => ({
            unitName: unit.unitName,
            proteinAmount: num(unit.proteinAmount),
          })),
        },
        newValue: body,
        ...requestMeta(request),
      })
    })

    return ok({ food: { id } })
  })
}
