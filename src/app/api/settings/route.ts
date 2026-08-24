import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { assertSettingValue, parseSettingValue, SETTING_DEFAULTS } from '@/lib/settings'
import { badRequest } from '@/lib/errors'

export async function GET() {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const rows = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    })
    return ok({
      settings: rows.map((row) => ({
        key: row.key,
        value: row.value,
        valueType: row.valueType,
        parsed: parseSettingValue(row.value, row.valueType),
        description: row.description,
        updatedAt: row.updatedAt,
      })),
    })
  })
}

const bodySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

/** ปรับ config ได้โดยไม่ต้อง redeploy — เช่น meal_backdate_days */
export async function PUT(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = bodySchema.parse(await request.json())

    const existing = await prisma.systemSetting.findUnique({
      where: { key: body.key },
    })
    const valueType = existing?.valueType ?? SETTING_DEFAULTS[body.key]?.valueType
    if (!valueType) throw badRequest('UNKNOWN_SETTING', `ไม่รู้จัก setting "${body.key}"`)

    try {
      assertSettingValue(body.key, body.value, valueType)
    } catch (error) {
      throw badRequest('INVALID_SETTING_VALUE', (error as Error).message)
    }

    await prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: body.key },
        create: {
          key: body.key,
          value: body.value,
          valueType,
          description: SETTING_DEFAULTS[body.key]?.description,
          updatedById: session.userId,
        },
        update: { value: body.value, updatedById: session.userId },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'SETTING_UPDATE',
        targetType: 'SystemSetting',
        targetId: body.key,
        oldValue: existing ? { value: existing.value } : undefined,
        newValue: { value: body.value },
        ...requestMeta(request),
      })
    })

    return ok({ key: body.key, value: body.value })
  })
}
