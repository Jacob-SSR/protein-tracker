import { prisma } from '@/lib/db/prisma'
import { destroyImages, isCloudinaryConfigured } from '@/lib/uploads/cloudinary'

/**
 * ลบไฟล์รูปที่ไม่มีบทความไหนอ้างถึงแล้ว
 *
 * ต้องเช็คก่อนเสมอว่ายังมีแถวไหนใช้อยู่ไหม เพราะบทความเก็บเป็นเวอร์ชัน
 * เวอร์ชันเก่ายังชี้ไปที่รูปเดิมได้ ลบทิ้งเลยจะทำให้ประวัติเสีย
 *
 * เรียกหลังลบ/แก้แถวใน DB เรียบร้อยแล้วเท่านั้น
 */
export async function destroyOrphanImages(publicIds: (string | null | undefined)[]) {
  const candidates = [...new Set(publicIds.filter((id): id is string => Boolean(id)))]
  if (candidates.length === 0 || !isCloudinaryConfigured()) return { deleted: 0, failed: [] }

  const stillUsed = await prisma.knowledge.findMany({
    where: { imagePublicId: { in: candidates } },
    select: { imagePublicId: true },
    distinct: ['imagePublicId'],
  })
  const usedIds = new Set(stillUsed.map((row) => row.imagePublicId))
  const orphans = candidates.filter((id) => !usedIds.has(id))

  const { failed } = await destroyImages(orphans)
  return { deleted: orphans.length - failed.length, failed }
}
