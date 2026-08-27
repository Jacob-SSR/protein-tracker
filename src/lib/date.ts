/**
 * ทุก field ที่เป็น @db.Date (mealDate, effectiveFrom/To, measuredOn) ต้องผ่านไฟล์นี้เท่านั้น
 * กติกา: เก็บเป็น Date ที่ตั้งเวลาไว้ที่ UTC midnight เสมอ ไม่มี time component
 * ห้ามใช้ new Date() ตรงๆ กับ field พวกนี้ — timezone จะเลื่อนวัน
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Bangkok'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** "2026-08-24" -> Date(2026-08-24T00:00:00.000Z) */
export function parseDateOnly(input: string): Date {
  if (!DATE_ONLY.test(input)) {
    throw new Error(`Invalid date, expected YYYY-MM-DD but got "${input}"`)
  }
  const [year, month, day] = input.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== day) {
    throw new Error(`Invalid date: "${input}"`)
  }
  return date
}

/** Date -> "2026-08-24" (อ่านจาก UTC part เสมอ) */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** วันนี้ตามเวลาโรงพยาบาล (ไม่ใช่ UTC ของ server) */
export function today(timeZone: string = APP_TIMEZONE): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parseDateOnly(parts)
}

/** ชั่วโมงปัจจุบัน (0-23) ตามเวลาโรงพยาบาล ไม่ใช่ UTC ของ server */
export function currentHour(timeZone: string = APP_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(new Date())
  return Number.parseInt(parts, 10)
}

export function tomorrow(timeZone: string = APP_TIMEZONE): Date {
  return addDays(today(timeZone), 1)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** จำนวนวันเต็มระหว่างสองวัน (b - a) */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** วันจันทร์ของสัปดาห์ที่ date อยู่ */
export function startOfWeek(date: Date): Date {
  const weekday = date.getUTCDay() // 0 = อาทิตย์
  const offset = weekday === 0 ? -6 : 1 - weekday
  return addDays(date, offset)
}

export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = []
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}
