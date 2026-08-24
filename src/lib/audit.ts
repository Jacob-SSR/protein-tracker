import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

type AuditClient = Prisma.TransactionClient | typeof prisma

export type AuditInput = {
  actorId: string | null
  action: string
  targetType: string
  targetId?: string | null
  oldValue?: Prisma.InputJsonValue | null
  newValue?: Prisma.InputJsonValue | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * AuditLog เป็น append-only — ไม่มี update/delete ที่ไหนในโค้ดเบสนี้
 * เรียกใน transaction เดียวกับ mutation เสมอ ถ้า rollback ต้อง rollback ไปด้วยกัน
 */
export async function writeAudit(client: AuditClient, input: AuditInput) {
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

export function requestMeta(request: Request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  }
}
