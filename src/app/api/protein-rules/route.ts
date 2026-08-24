import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { num, toDecimal } from '@/lib/decimal'
import { ADMIN_ROLES } from '@/lib/permissions'

export const ruleBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  priority: z.number().int().min(1).max(9999),
  /** ฐานน้ำหนักที่จะเอาไปคูณกับ proteinFactor */
  weightBasis: z.enum(['ACTUAL', 'IBW', 'ADJUSTED']).default('ACTUAL'),
  /** g โปรตีน / kg น้ำหนักตัว / วัน — ใช้ค่าเดียวทั้งกฎ */
  proteinFactor: z.number().min(0.1).max(5),
  isActive: z.boolean().default(true),
  conditions: z
    .array(
      z.object({
        conditionType: z.enum([
          'GENDER',
          'EGFR',
          'ALBUMIN',
          'BUN',
          'CREATININE',
          'POTASSIUM',
          'PHOSPHORUS',
          'BMI',
          'AGE',
          'WEIGHT',
          'CKD_STAGE',
          'COMORBIDITY',
          'DIALYSIS',
        ]),
        operator: z.enum(['LT', 'LTE', 'GT', 'GTE', 'EQ', 'NEQ']),
        value: z.string().trim().min(1).max(50),
      }),
    )
    .min(1)
    .max(10),
})

export async function GET() {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const rules = await prisma.proteinRule.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }],
      include: { conditions: { orderBy: { sortOrder: 'asc' } } },
    })

    return ok({
      rules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        weightBasis: rule.weightBasis,
        version: rule.version,
        isActive: rule.isActive,
        proteinFactor: rule.conditions[0] ? num(rule.conditions[0].proteinFactor) : null,
        conditions: rule.conditions.map((condition) => ({
          id: condition.id,
          conditionType: condition.conditionType,
          operator: condition.operator,
          value: condition.value,
        })),
      })),
    })
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = ruleBodySchema.parse(await request.json())

    const rule = await prisma.$transaction(async (tx) => {
      const created = await tx.proteinRule.create({
        data: {
          name: body.name,
          description: body.description || null,
          priority: body.priority,
          weightBasis: body.weightBasis,
          isActive: body.isActive,
          createdById: session.userId,
          conditions: {
            create: body.conditions.map((condition, index) => ({
              ...condition,
              proteinFactor: toDecimal(body.proteinFactor),
              sortOrder: index,
            })),
          },
        },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PROTEIN_RULE_CREATE',
        targetType: 'ProteinRule',
        targetId: created.id,
        newValue: body,
        ...requestMeta(request),
      })
      return created
    })

    return ok({ rule: { id: rule.id, name: rule.name } }, 201)
  })
}
