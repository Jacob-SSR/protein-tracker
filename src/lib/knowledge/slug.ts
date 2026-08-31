/**
 * สร้าง slug จากหัวข้อบทความ — เจ้าหน้าที่ไม่ต้องคิดเอง
 *
 * เก็บตัวอักษรไทยไว้ด้วย ไม่ทับศัพท์เป็นอังกฤษ เพราะหัวข้อส่วนใหญ่เป็นภาษาไทย
 * ถ้าตัดทิ้งจะเหลือ slug ว่างแทบทุกอัน เบราว์เซอร์เข้ารหัสอักษรไทยใน URL ให้อยู่แล้ว
 */

/** ช่วงอักษรไทยใน Unicode (ก-๛ รวมสระ วรรณยุกต์ และเลขไทย) */
const THAI = '฀-๿'

export const SLUG_MAX_LENGTH = 80

export function slugify(title: string): string {
  return (
    title
      .normalize('NFC')
      .toLowerCase()
      .trim()
      // อะไรที่ไม่ใช่ไทย/a-z/0-9 กลายเป็นขีด รวมช่องว่างและอักขระพิเศษ
      .replace(new RegExp(`[^${THAI}a-z0-9]+`, 'g'), '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, SLUG_MAX_LENGTH)
      .replace(/-$/, '')
  )
}

/**
 * ทำให้ slug ไม่ซ้ำของเดิม โดยต่อท้ายด้วย -2, -3 ไปเรื่อยๆ
 *
 * หัวข้อว่างหรือมีแต่อักขระพิเศษจะได้ slug ว่าง — ใช้ 'บทความ' เป็นฐานแทน
 * จะได้ไม่กลายเป็น URL เปล่าหรือชนกันเองทุกอัน
 */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const base = slugify(title) || 'บทความ'
  const used = new Set(taken)
  if (!used.has(base)) return base

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    // ตัดฐานให้สั้นลงก่อนต่อเลข เพื่อไม่ให้ยาวเกิน SLUG_MAX_LENGTH
    const tail = `-${suffix}`
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - tail.length).replace(/-$/, '')}${tail}`
    if (!used.has(candidate)) return candidate
  }

  return `${base.slice(0, SLUG_MAX_LENGTH - 14)}-${Date.now().toString(36)}`
}
