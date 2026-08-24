import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { num, toDecimal } from '@/lib/decimal'
import { ADMIN_ROLES } from '@/lib/permissions'
import { notFound } from '@/lib/errors'
import { ruleBodySchema } from '../route'

type Params = { params: Promise<{ id: string }> }

/**
 * แก้กฎ = bump version เสมอ
 * ProteinCalculation เก่าเก็บ ruleVersion + ruleNameSnapshot ไว้แล้ว ผลย้อนหลังจึงไม่เปลี่ยนตาม
 */
export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const body = ruleBodySchema.parse(await request.json())

    const existing = await prisma.proteinRule.findUnique({
      where: { id },
      include: { conditions: true },
    })
    if (!existing) throw notFound('ไม่พบกฎนี้')

    await prisma.$transaction(async (tx) => {
      await tx.proteinRuleCondition.deleteMany({ where: { ruleId: id } })
      await tx.proteinRule.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description || null,
          priority: body.priority,
          isActive: body.isActive,
          version: { increment: 1 },
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
        action: 'PROTEIN_RULE_UPDATE',
        targetType: 'ProteinRule',
        targetId: id,
        oldValue: {
          name: existing.name,
          priority: existing.priority,
          version: existing.version,
          isActive: existing.isActive,
          proteinFactor: existing.conditions[0] ? num(existing.conditions[0].proteinFactor) : null,
          conditions: existing.conditions.map((condition) => ({
            conditionType: condition.conditionType,
            operator: condition.operator,
            value: condition.value,
          })),
        },
        newValue: { ...body, version: existing.version + 1 },
        ...requestMeta(request),
      })
    })

    return ok({ rule: { id, version: existing.version + 1 } })
  })
}

/** ปิดการใช้งานเท่านั้น ไม่ลบจริง — ProteinCalculation เก่ายังอ้าง ruleId อยู่ */
export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params

    const existing = await prisma.proteinRule.findUnique({ where: { id } })
    if (!existing) throw notFound('ไม่พบกฎนี้')

    await prisma.$transaction(async (tx) => {
      await tx.proteinRule.update({ where: { id }, data: { isActive: false } })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PROTEIN_RULE_DEACTIVATE',
        targetType: 'ProteinRule',
        targetId: id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: false },
        ...requestMeta(request),
      })
    })

    return ok({ id, isActive: false })
  })
}
