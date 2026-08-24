import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES, isAdmin } from '@/lib/permissions'
import { conflict } from '@/lib/errors'
import { Prisma } from '@prisma/client'

/** ผู้ป่วยเห็นเฉพาะเวอร์ชันที่เผยแพร่แล้ว, admin เห็นทุกเวอร์ชัน */
export async function GET() {
  return handle(async () => {
    const session = await requireSession()

    const rows = await prisma.knowledge.findMany({
      where: isAdmin(session) ? undefined : { isPublished: true },
      orderBy: [{ slug: 'asc' }, { version: 'desc' }],
      include: { author: { select: { fullName: true } } },
    })

    return ok({ articles: rows })
  })
}

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'ใช้ได้เฉพาะ a-z 0-9 และ -'),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
  isPublished: z.boolean().default(false),
})

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = createSchema.parse(await request.json())

    try {
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.knowledge.create({
          data: { ...body, version: 1, authorId: session.userId },
        })
        await writeAudit(tx, {
          actorId: session.userId,
          action: 'KNOWLEDGE_CREATE',
          targetType: 'Knowledge',
          targetId: row.id,
          newValue: {
            slug: row.slug,
            version: row.version,
            isPublished: row.isPublished,
          },
          ...requestMeta(request),
        })
        return row
      })

      return ok({ article: created }, 201)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('DUPLICATE_SLUG', 'slug นี้มีอยู่แล้ว ใช้หน้าแก้ไขเพื่อสร้างเวอร์ชันใหม่')
      }
      throw error
    }
  })
}
