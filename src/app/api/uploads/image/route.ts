import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { ADMIN_ROLES } from '@/lib/permissions'
import { destroyOrphanImages } from '@/lib/knowledge/images'

const bodySchema = z.object({
  publicId: z.string().trim().min(1).max(200),
})

/**
 * ลบไฟล์ที่เพิ่งอัปโหลดแต่ยังไม่ได้ใช้
 *
 * เกิดตอนคนเขียนบทความกด "เปลี่ยนรูป" หรือ "เอารูปออก" ก่อนกดบันทึก
 * ไฟล์นั้นขึ้น Cloudinary ไปแล้วแต่จะไม่มีบทความไหนอ้างถึงเลย
 * ถ้าไม่เก็บกวาดตรงนี้ ไฟล์ขยะจะสะสมไปเรื่อยๆ
 *
 * destroyOrphanImages เช็คก่อนเสมอว่ามีบทความใช้อยู่ไหม
 * ยิงมาด้วย public_id ของรูปที่ใช้งานจริงก็ลบไม่ได้
 */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const { publicId } = bodySchema.parse(await request.json())

    return ok({ images: await destroyOrphanImages([publicId]) })
  })
}
