import { z } from 'zod'
import { uniqueSlug } from '@/lib/knowledge/slug'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES, isAdmin } from '@/lib/permissions'
import { conflict } from '@/lib/errors'
import {
  assertOwnCloudinaryUrl,
  assertSafeExternalUrl,
  getCloudinaryConfig,
} from '@/lib/uploads/cloudinary'
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
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
  imageUrl: z.string().trim().url().max(500).nullish(),
  imagePublicId: z.string().trim().max(200).nullish(),
  imageWidth: z.number().int().positive().max(20000).nullish(),
  imageHeight: z.number().int().positive().max(20000).nullish(),
  linkUrl: z.string().trim().url().max(500).nullish(),
  linkLabel: z.string().trim().max(120).nullish(),
  isPublished: z.boolean().default(false),
})

/**
 * ตรวจรูปกับลิงก์ก่อนเขียนลง DB
 * รูปต้องเป็นของ cloud เรา ลิงก์ต้องเป็น http/https — กันคนยิง API ตรงๆ
 * ใส่ URL อะไรก็ได้ลงบทความที่ผู้ป่วยเห็น
 */
export function normalizeMedia(input: {
  imageUrl?: string | null
  imagePublicId?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  linkUrl?: string | null
  linkLabel?: string | null
}) {
  const { cloudName } = input.imageUrl ? getCloudinaryConfig() : { cloudName: '' }
  const hasImage = Boolean(input.imageUrl)
  return {
    imageUrl: input.imageUrl ? assertOwnCloudinaryUrl(input.imageUrl, cloudName) : null,
    imagePublicId: input.imagePublicId || null,
    // ขนาดผูกกับรูป ไม่มีรูปก็ต้องไม่มีขนาดค้างไว้
    imageWidth: hasImage ? (input.imageWidth ?? null) : null,
    imageHeight: hasImage ? (input.imageHeight ?? null) : null,
    linkUrl: input.linkUrl ? assertSafeExternalUrl(input.linkUrl) : null,
    linkLabel: input.linkLabel?.trim() || null,
  }
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = createSchema.parse(await request.json())

    try {
      const media = normalizeMedia(body)

      // slug มาจากหัวข้อ ไม่ให้คนกรอกเอง — ชนของเดิมก็ต่อ -2, -3 ให้อัตโนมัติ
      const existing = await prisma.knowledge.findMany({
        select: { slug: true },
        distinct: ['slug'],
      })
      const slug = uniqueSlug(
        body.title,
        existing.map((row) => row.slug),
      )

      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.knowledge.create({
          data: { ...body, ...media, slug, version: 1, authorId: session.userId },
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
        // แข่งกันสร้างพร้อมกันจน slug ชนพอดี — ผู้ใช้แค่กดบันทึกอีกครั้งก็ได้เลขใหม่
        throw conflict(
          'DUPLICATE_SLUG',
          'มีบทความชื่อนี้ถูกสร้างพร้อมกันพอดี กดบันทึกอีกครั้งได้เลย',
        )
      }
      throw error
    }
  })
}
