import { z } from 'zod'
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
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'ใช้ได้เฉพาะ a-z 0-9 และ -'),
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

      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.knowledge.create({
          data: { ...body, ...media, version: 1, authorId: session.userId },
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
