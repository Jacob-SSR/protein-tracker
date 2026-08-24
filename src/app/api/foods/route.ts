import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { num, toDecimal } from '@/lib/decimal'
import { isAdmin } from '@/lib/permissions'
import { badRequest } from '@/lib/errors'

const querySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'ARCHIVED']).optional(),
  take: z.coerce.number().int().min(1).max(100).default(30),
})

export async function GET(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const { q, status, take } = querySchema.parse(Object.fromEntries(searchParams))

    // ผู้ป่วยเห็นได้เฉพาะอาหารที่อนุมัติแล้วเท่านั้น
    const effectiveStatus = isAdmin(session) ? status : 'ACTIVE'

    const foods = await prisma.food.findMany({
      where: {
        status: effectiveStatus,
        name: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      take,
      orderBy: { name: 'asc' },
      include: { units: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] } },
    })

    return ok({
      foods: foods.map((food) => ({
        id: food.id,
        name: food.name,
        category: food.category,
        status: food.status,
        units: food.units.map((unit) => ({
          id: unit.id,
          unitName: unit.unitName,
          gramsPerUnit: unit.gramsPerUnit ? num(unit.gramsPerUnit) : null,
          proteinAmount: num(unit.proteinAmount),
          isDefault: unit.isDefault,
        })),
      })),
    })
  })
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  units: z
    .array(
      z.object({
        unitName: z.string().trim().min(1).max(50),
        gramsPerUnit: z.number().positive().optional(),
        proteinAmount: z.number().min(0),
        isDefault: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(10),
})

/**
 * ผู้ป่วยเสนออาหารใหม่ -> status = PENDING (ห้ามเข้า database ทันที)
 * admin สร้างเอง -> ACTIVE ได้เลย
 */
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const body = createSchema.parse(await request.json())

    const defaults = body.units.filter((unit) => unit.isDefault)
    if (defaults.length > 1) throw badRequest('MULTIPLE_DEFAULT_UNITS', 'ตั้งหน่วยหลักได้หน่วยเดียว')

    const admin = isAdmin(session)

    const food = await prisma.$transaction(async (tx) => {
      const created = await tx.food.create({
        data: {
          name: body.name,
          category: body.category ?? null,
          description: body.description ?? null,
          status: admin ? 'ACTIVE' : 'PENDING',
          proposedById: session.userId,
          approvedById: admin ? session.userId : null,
          approvedAt: admin ? new Date() : null,
          units: {
            create: body.units.map((unit, index) => ({
              unitName: unit.unitName,
              gramsPerUnit: unit.gramsPerUnit ? toDecimal(unit.gramsPerUnit) : null,
              proteinAmount: toDecimal(unit.proteinAmount),
              isDefault: unit.isDefault ?? index === 0,
              sortOrder: index,
            })),
          },
        },
        include: { units: true },
      })

      await writeAudit(tx, {
        actorId: session.userId,
        action: admin ? 'FOOD_CREATE' : 'FOOD_PROPOSE',
        targetType: 'Food',
        targetId: created.id,
        newValue: { name: created.name, status: created.status, units: body.units },
        ...requestMeta(request),
      })

      return created
    })

    return ok({ food: { id: food.id, name: food.name, status: food.status } }, 201)
  })
}
