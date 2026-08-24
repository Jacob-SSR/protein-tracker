import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { canReadAuditLog } from '@/lib/permissions'
import { forbidden } from '@/lib/errors'

const querySchema = z.object({
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  actorId: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

/** อ่านอย่างเดียว — ไม่มี POST/PATCH/DELETE โดยตั้งใจ audit log ห้ามแก้/ลบ */
export async function GET(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    if (!canReadAuditLog(session)) throw forbidden('เฉพาะ SUPER_ADMIN เท่านั้นที่ดู Audit Log ได้')

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))

    const logs = await prisma.auditLog.findMany({
      where: {
        targetType: query.targetType,
        targetId: query.targetId,
        actorId: query.actorId,
      },
      take: query.take,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { username: true, fullName: true } } },
    })

    return ok({
      logs,
      nextCursor: logs.length === query.take ? logs.at(-1)?.id : null,
    })
  })
}
