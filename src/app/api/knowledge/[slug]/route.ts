import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { notFound } from '@/lib/errors'
import { normalizeMedia } from '../route'
import { destroyOrphanImages } from '@/lib/knowledge/images'

type Params = { params: Promise<{ slug: string }> }

const bodySchema = z.object({
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
 * แก้บทความ = สร้างแถวเวอร์ชันใหม่ ไม่ทับของเดิม
 * ถ้าเผยแพร่เวอร์ชันใหม่ ให้ปลดเผยแพร่เวอร์ชันเก่าของ slug เดียวกัน
 * ผู้ป่วยจึงเห็นเวอร์ชันเดียวเสมอ แต่ประวัติยังอยู่ครบ
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { slug } = await params
    const body = bodySchema.parse(await request.json())

    const latest = await prisma.knowledge.findFirst({
      where: { slug },
      orderBy: { version: 'desc' },
    })
    if (!latest) throw notFound('ไม่พบบทความนี้')

    const created = await prisma.$transaction(async (tx) => {
      if (body.isPublished) {
        await tx.knowledge.updateMany({
          where: { slug },
          data: { isPublished: false },
        })
      }
      const row = await tx.knowledge.create({
        data: {
          slug,
          title: body.title,
          content: body.content,
          ...normalizeMedia(body),
          isPublished: body.isPublished,
          version: latest.version + 1,
          authorId: session.userId,
        },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'KNOWLEDGE_NEW_VERSION',
        targetType: 'Knowledge',
        targetId: row.id,
        oldValue: { version: latest.version, isPublished: latest.isPublished },
        newValue: { version: row.version, isPublished: row.isPublished },
        ...requestMeta(request),
      })
      return row
    })

    return ok({ article: created }, 201)
  })
}

/**
 * ลบบทความทั้งก้อน — ทุกเวอร์ชันของ slug นี้ พร้อมไฟล์รูปบน Cloudinary
 *
 * ลำดับสำคัญ: ลบแถวใน DB ให้เสร็จก่อน แล้วค่อยลบไฟล์
 * ถ้าลบไฟล์ก่อนแล้ว transaction rollback จะได้บทความที่รูปหายไปแล้ว
 * ส่วนลบไฟล์พลาดไม่ทำให้ทั้ง request ล้ม แค่บอกกลับไปว่าไฟล์ไหนค้าง
 */
export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { slug } = await params

    const versions = await prisma.knowledge.findMany({
      where: { slug },
      select: { id: true, version: true, title: true, imagePublicId: true },
    })
    if (versions.length === 0) throw notFound('ไม่พบบทความนี้')

    await prisma.$transaction(async (tx) => {
      await tx.knowledge.deleteMany({ where: { slug } })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'KNOWLEDGE_DELETE',
        targetType: 'Knowledge',
        targetId: slug,
        oldValue: {
          slug,
          title: versions[0]?.title ?? null,
          versions: versions.length,
          imagePublicIds: versions.map((row) => row.imagePublicId).filter(Boolean),
        },
        ...requestMeta(request),
      })
    })

    const images = await destroyOrphanImages(versions.map((row) => row.imagePublicId))

    return ok({
      deleted: { slug, versions: versions.length },
      images,
    })
  })
}
