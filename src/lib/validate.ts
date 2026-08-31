/**
 * ตัวตรวจค่าในฟอร์ม ใช้ร่วมกันทุกหน้า
 *
 * คืน string = ข้อความบอกว่าผิดตรงไหน, null = ผ่าน
 * ตั้งใจให้ข้อความบอกวิธีแก้ ไม่ใช่แค่บอกว่าผิด — คนกรอกจะได้ทำต่อได้เลย
 * ฝั่ง API ยังตรวจซ้ำด้วย zod เสมอ ตัวนี้เป็นแค่ชั้นที่ช่วยให้รู้ตัวก่อนกดบันทึก
 */

export function requiredText(value: string, label: string, max?: number): string | null {
  if (value.trim() === '') return `กรอก${label}ด้วย`
  if (max !== undefined && value.trim().length > max) {
    return `${label}ยาวเกิน ${max} ตัวอักษร (ตอนนี้ ${value.trim().length})`
  }
  return null
}

export function optionalText(value: string, label: string, max: number): string | null {
  if (value.trim().length > max) {
    return `${label}ยาวเกิน ${max} ตัวอักษร (ตอนนี้ ${value.trim().length})`
  }
  return null
}

/** ตัวเลขที่ต้องกรอก และต้องอยู่ในช่วงที่เป็นไปได้จริง */
export function requiredNumber(
  value: string,
  label: string,
  range?: { min?: number; max?: number },
): string | null {
  if (value.trim() === '') return `กรอก${label}ด้วย`
  return numberInRange(value, label, range)
}

/** ตัวเลขที่ไม่บังคับ — ว่างได้ แต่ถ้ากรอกต้องถูกต้อง */
export function optionalNumber(
  value: string,
  label: string,
  range?: { min?: number; max?: number },
): string | null {
  if (value.trim() === '') return null
  return numberInRange(value, label, range)
}

function numberInRange(
  value: string,
  label: string,
  range?: { min?: number; max?: number },
): string | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${label}ต้องเป็นตัวเลข`
  if (range?.min !== undefined && parsed < range.min) {
    return `${label}ต้องไม่น้อยกว่า ${range.min}`
  }
  if (range?.max !== undefined && parsed > range.max) {
    return `${label}ต้องไม่เกิน ${range.max}`
  }
  return null
}

/** ลิงก์ที่ไม่บังคับ — ว่างได้ แต่ถ้ากรอกต้องเป็น http/https จริงๆ */
export function optionalUrl(value: string, label = 'ลิงก์'): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return `${label}ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://`
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `${label}รองรับเฉพาะ http และ https`
  }
  return null
}

/** วันที่ในรูปแบบ YYYY-MM-DD ที่ต้องมีอยู่จริงและไม่ล้ำอนาคต (ถ้าห้าม) */
export function dateValue(
  value: string,
  label: string,
  options?: { required?: boolean; allowFuture?: boolean },
): string | null {
  if (value.trim() === '') return options?.required ? `เลือก${label}ด้วย` : null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return `${label}ไม่ถูกต้อง`
  if (options?.allowFuture === false && parsed.getTime() > Date.now()) {
    return `${label}เลือกวันในอนาคตไม่ได้`
  }
  return null
}

/** true = มีอย่างน้อยหนึ่งช่องที่ยังผิดอยู่ */
export function hasErrors(errors: Record<string, string | null | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}
