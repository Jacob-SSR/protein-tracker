/**
 * แปลงกรัมโปรตีนเป็น "ช้อน" ให้ผู้ป่วยเข้าใจง่ายกว่าตัวเลขกรัม
 *
 *   7 กรัม = 2 ช้อน  ->  1 ช้อน = 3.5 กรัม
 *
 * ใช้กับการ "แสดงผล" เท่านั้น การคำนวณและการเก็บลงฐานข้อมูลยังเป็นกรัมทั้งหมด
 * ถ้าเก็บเป็นช้อนจะเสียความละเอียดและคำนวณย้อนกลับไม่ตรง
 */

export const GRAMS_PER_SPOON = 3.5

/** ปัดทศนิยม 1 ตำแหน่ง — ค่าดิบสำหรับคำนวณเปอร์เซ็นต์/เทียบค่า ไม่ได้ตั้งใจให้โชว์ตรงๆ */
export function gramsToSpoons(grams: number | null | undefined): number | null {
  if (grams === null || grams === undefined || !Number.isFinite(grams)) return null
  return Math.round((grams / GRAMS_PER_SPOON) * 10) / 10
}

export function spoonsToGrams(spoons: number): number {
  return Math.round(spoons * GRAMS_PER_SPOON * 100) / 100
}

/** จุดที่เลิกใช้เศษส่วน — เกินนี้ไป ¼ ช้อนไม่มีผลอะไรแล้ว ปัดเป็นจำนวนเต็มอ่านง่ายกว่า */
const WHOLE_SPOON_FROM = 5

const FRACTION_LABELS: Record<number, string> = {
  0.25: '¼',
  0.5: '½',
  0.75: '¾',
}

export type SpoonDisplay = {
  /** ปริมาณที่ตวงตามได้จริง เช่น "2¾" หรือ "15" — ไม่มีค่าคืน "—" */
  text: string
  /** ตัวเลขหลังปัด ใช้เทียบต่อได้ null = ไม่มีข้อมูล */
  value: number | null
  /** ค่าจริงก่อนปัด ไว้แสดงเป็นตัวเล็กเวลาต้องการความแม่นยำ */
  exact: number | null
  /** ปัดจากค่าจริงจริงๆ ไหม — ใช้ตัดสินว่าจะขึ้นข้อความ "ปัดเป็นปริมาณที่ตวงได้ง่าย" หรือเปล่า */
  rounded: boolean
}

const NOTHING: SpoonDisplay = { text: '—', value: null, exact: null, rounded: false }

/**
 * ปัดช้อนให้ตวงได้จริงในครัว
 *
 * ตั้งแต่ 5 ช้อนขึ้นไปปัดเป็นจำนวนเต็ม (14.9 -> 15) เพราะเศษ ¼ ช้อนในปริมาณเท่านี้
 * ไม่มีผลต่อการควบคุมโปรตีน แต่ทำให้ตัวเลขอ่านยากขึ้น
 * ต่ำกว่านั้นปัดเป็นทีละ ¼ ช้อน (2.67 -> 2¾) ซึ่งเป็นหน่วยที่ช้อนตวงในบ้านมีจริง
 *
 * ค่าที่มากกว่า 0 แต่ปัดลงแล้วเหลือ 0 จะไม่กลายเป็น "0 ช้อน" เพราะผู้ป่วยทานไปแล้วจริง
 * — แสดงเป็น "น้อยกว่า ¼" แทน
 */
export function toSpoonDisplay(grams: number | null | undefined): SpoonDisplay {
  const exact = gramsToSpoons(grams)
  if (exact === null) return NOTHING
  if (exact === 0) return { text: '0', value: 0, exact: 0, rounded: false }

  if (exact >= WHOLE_SPOON_FROM) {
    const value = Math.round(exact)
    return { text: String(value), value, exact, rounded: value !== exact }
  }

  const value = Math.round(exact * 4) / 4
  if (value === 0) {
    return { text: 'น้อยกว่า ¼', value: 0.25, exact, rounded: true }
  }

  const whole = Math.floor(value)
  const fraction = FRACTION_LABELS[Math.round((value - whole) * 100) / 100]

  return {
    text: fraction ? (whole === 0 ? fraction : `${whole}${fraction}`) : String(whole),
    value,
    exact,
    rounded: value !== exact,
  }
}

/** ข้อความพร้อมแสดง เช่น "2¾ ช้อน" — ไม่มีค่าให้คืนขีดกลาง */
export function formatSpoons(grams: number | null | undefined): string {
  const display = toSpoonDisplay(grams)
  return display.value === null ? '—' : `${display.text} ช้อน`
}
