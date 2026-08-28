import { prisma } from '@/lib/db/prisma'
import type { SettingValueType } from '@prisma/client'

/**
 * Config ที่ปรับได้โดยไม่ต้อง redeploy
 * ค่า default ในไฟล์นี้ใช้เฉพาะตอนที่ยังไม่มีแถวใน DB (เช่น ก่อน seed)
 */
export const SETTING_KEYS = {
  /** -1 = ย้อนหลังได้ไม่จำกัด, 0 = วันนี้เท่านั้น, n = ย้อนหลังได้ n วัน */
  MEAL_BACKDATE_DAYS: 'meal_backdate_days',
  /** ห้ามบันทึกล่วงหน้าเกินกี่วัน (0 = ห้ามล่วงหน้าเลย) */
  MEAL_FUTURE_DAYS: 'meal_future_days',
  NOTIFY_THRESHOLDS: 'notify_thresholds',
  /** เปิดให้ผู้ป่วยล็อกอินเข้าดูข้อมูลตัวเองได้หรือไม่ — ปิดไว้ = ระบบสำหรับเจ้าหน้าที่ล้วน */
  PATIENT_PORTAL_ENABLED: 'patient_portal_enabled',
  /** ปริมาณน้ำต่อ 1 แก้ว (มล.) — ห้าม hardcode 250 ที่อื่น อ่านจากตรงนี้เสมอ */
  WATER_GLASS_SIZE_ML: 'water_glass_size_ml',
  /** น้ำที่ควรดื่มต่อน้ำหนักตัว 1 กก. (มล./กก./วัน) */
  WATER_ML_PER_KG: 'water_ml_per_kg',
  /** เพดานน้ำต่อวันสำหรับผู้ป่วยที่ต้องจำกัดน้ำ (บวม / ระยะ 4-5 / ฟอกไต) */
  WATER_RESTRICTED_MAX_ML: 'water_restricted_max_ml',
  /** เริ่มเตือน "ยังดื่มไม่ครบ" ตั้งแต่กี่โมง (0-23) */
  WATER_REMINDER_HOUR: 'water_reminder_hour',
  /** รอบการตรวจสุขภาพ (เดือน) — ค่ามาตรฐานคือทุก 3 เดือน */
  EXAM_INTERVAL_MONTHS: 'exam_interval_months',
} as const

export const SETTING_DEFAULTS: Record<
  string,
  { value: string; valueType: SettingValueType; description: string }
> = {
  [SETTING_KEYS.MEAL_BACKDATE_DAYS]: {
    value: '-1',
    valueType: 'INT',
    description: 'บันทึกอาหารย้อนหลังได้กี่วัน (-1 = ไม่จำกัด, 0 = วันนี้เท่านั้น)',
  },
  [SETTING_KEYS.MEAL_FUTURE_DAYS]: {
    value: '0',
    valueType: 'INT',
    description: 'บันทึกอาหารล่วงหน้าได้กี่วัน (0 = ห้ามล่วงหน้า)',
  },
  [SETTING_KEYS.PATIENT_PORTAL_ENABLED]: {
    value: 'false',
    valueType: 'BOOLEAN',
    description: 'เปิดให้ผู้ป่วยล็อกอินเข้าดูข้อมูลและบันทึกอาหารเองได้',
  },
  [SETTING_KEYS.WATER_GLASS_SIZE_ML]: {
    value: '250',
    valueType: 'INT',
    description: 'ปริมาณน้ำต่อ 1 แก้ว (มล.)',
  },
  [SETTING_KEYS.WATER_ML_PER_KG]: {
    value: '30',
    valueType: 'INT',
    description: 'น้ำที่ควรดื่มต่อน้ำหนักตัว 1 กก. ต่อวัน (มล.) — ใช้กับผู้ป่วยที่ไม่ต้องจำกัดน้ำ',
  },
  [SETTING_KEYS.WATER_RESTRICTED_MAX_ML]: {
    value: '1000',
    valueType: 'INT',
    description:
      'เพดานน้ำต่อวันเมื่อผู้ป่วยต้องจำกัดน้ำ (มล.) — ใช้เมื่อมีภาวะบวม ระยะ 4-5 หรือฟอกไต',
  },
  [SETTING_KEYS.WATER_REMINDER_HOUR]: {
    value: '20',
    valueType: 'INT',
    description: 'เริ่มเตือนว่ายังดื่มน้ำไม่ครบตั้งแต่กี่โมง (0-23) — ค่าเริ่มต้น 20 น.',
  },
  [SETTING_KEYS.EXAM_INTERVAL_MONTHS]: {
    value: '3',
    valueType: 'INT',
    description: 'ผู้ป่วยควรตรวจสุขภาพทุกกี่เดือน — ใช้บอกว่าถึงรอบตรวจหรือยัง',
  },
  [SETTING_KEYS.NOTIFY_THRESHOLDS]: {
    value: JSON.stringify([
      {
        percent: 80,
        level: 'INFO',
        message: 'ทานโปรตีนถึง 80% ของเป้าหมายแล้ว',
      },
      {
        percent: 90,
        level: 'WARN',
        message: 'ใกล้ถึงเป้าหมายแล้ว เหลืออีกนิดเดียว',
      },
      {
        percent: 100,
        level: 'WARN',
        message: 'ถึงเป้าหมายโปรตีนของวันนี้แล้ว',
      },
      {
        percent: 110,
        level: 'DANGER',
        message: 'เกินเป้าหมายแล้ว ควรงดโปรตีนเพิ่ม',
      },
    ]),
    valueType: 'JSON',
    description: 'เกณฑ์แจ้งเตือน % ของเป้าหมายโปรตีนรายวัน',
  },
}

export type NotifyThreshold = {
  percent: number
  level: 'INFO' | 'WARN' | 'DANGER'
  message: string
}

async function readRaw(key: string): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  return row?.value ?? SETTING_DEFAULTS[key]?.value ?? ''
}

export async function getIntSetting(key: string): Promise<number> {
  const parsed = Number.parseInt(await readRaw(key), 10)
  return Number.isFinite(parsed) ? parsed : Number.parseInt(SETTING_DEFAULTS[key].value, 10)
}

export async function getMealBackdateDays(): Promise<number> {
  return getIntSetting(SETTING_KEYS.MEAL_BACKDATE_DAYS)
}

export async function getMealFutureDays(): Promise<number> {
  return getIntSetting(SETTING_KEYS.MEAL_FUTURE_DAYS)
}

export async function isPatientPortalEnabled(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEYS.PATIENT_PORTAL_ENABLED },
  })
  return (row?.value ?? SETTING_DEFAULTS[SETTING_KEYS.PATIENT_PORTAL_ENABLED].value) === 'true'
}

export async function getWaterSettings(): Promise<{
  glassSizeMl: number
  mlPerKg: number
  restrictedMaxMl: number
  reminderHour: number
}> {
  const [glassSizeMl, mlPerKg, restrictedMaxMl, reminderHour] = await Promise.all([
    getIntSetting(SETTING_KEYS.WATER_GLASS_SIZE_ML),
    getIntSetting(SETTING_KEYS.WATER_ML_PER_KG),
    getIntSetting(SETTING_KEYS.WATER_RESTRICTED_MAX_ML),
    getIntSetting(SETTING_KEYS.WATER_REMINDER_HOUR),
  ])
  return { glassSizeMl, mlPerKg, restrictedMaxMl, reminderHour }
}

export async function getExamIntervalMonths(): Promise<number> {
  return getIntSetting(SETTING_KEYS.EXAM_INTERVAL_MONTHS)
}

export async function getNotifyThresholds(): Promise<NotifyThreshold[]> {
  try {
    const parsed = JSON.parse(await readRaw(SETTING_KEYS.NOTIFY_THRESHOLDS))
    return Array.isArray(parsed) ? (parsed as NotifyThreshold[]) : []
  } catch {
    return JSON.parse(SETTING_DEFAULTS[SETTING_KEYS.NOTIFY_THRESHOLDS].value)
  }
}

/** ตรวจโครงสร้างของ setting ที่ระบบรู้จัก — UI ส่งค่ามายังไงก็ต้องผ่านด่านนี้เสมอ */
export function validateKnownSetting(key: string, value: string) {
  if (key === SETTING_KEYS.MEAL_BACKDATE_DAYS) {
    const days = Number.parseInt(value, 10)
    if (!Number.isInteger(days) || days < -1 || days > 365) {
      throw new Error('ต้องเป็น -1 (ไม่จำกัด) หรือจำนวนวัน 0-365')
    }
    return
  }

  if (key === SETTING_KEYS.MEAL_FUTURE_DAYS) {
    const days = Number.parseInt(value, 10)
    if (!Number.isInteger(days) || days < 0 || days > 30) {
      throw new Error('ต้องเป็นจำนวนวัน 0-30')
    }
    return
  }

  if (key === SETTING_KEYS.PATIENT_PORTAL_ENABLED) {
    if (value !== 'true' && value !== 'false') throw new Error('ต้องเป็น true หรือ false')
    return
  }

  if (key === SETTING_KEYS.WATER_GLASS_SIZE_ML) {
    const ml = Number.parseInt(value, 10)
    if (!Number.isInteger(ml) || ml < 50 || ml > 2000) throw new Error('ต้องเป็น 50-2000 มล.')
    return
  }

  if (key === SETTING_KEYS.WATER_ML_PER_KG) {
    const ml = Number.parseInt(value, 10)
    if (!Number.isInteger(ml) || ml < 10 || ml > 60) throw new Error('ต้องเป็น 10-60 มล./กก./วัน')
    return
  }

  if (key === SETTING_KEYS.WATER_RESTRICTED_MAX_ML) {
    const ml = Number.parseInt(value, 10)
    if (!Number.isInteger(ml) || ml < 300 || ml > 5000) throw new Error('ต้องเป็น 300-5000 มล.')
    return
  }

  if (key === SETTING_KEYS.WATER_REMINDER_HOUR) {
    const hour = Number.parseInt(value, 10)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('ต้องเป็นชั่วโมง 0-23')
    return
  }

  if (key === SETTING_KEYS.EXAM_INTERVAL_MONTHS) {
    const months = Number.parseInt(value, 10)
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      throw new Error('ต้องเป็นจำนวนเดือน 1-24')
    }
    return
  }

  if (key === SETTING_KEYS.NOTIFY_THRESHOLDS) {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error('รูปแบบข้อมูลไม่ถูกต้อง')
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('ต้องมีเกณฑ์แจ้งเตือนอย่างน้อย 1 ข้อ')
    }
    for (const row of parsed as NotifyThreshold[]) {
      if (typeof row?.percent !== 'number' || row.percent <= 0 || row.percent > 500) {
        throw new Error('เปอร์เซ็นต์ต้องอยู่ระหว่าง 1-500')
      }
      if (!['INFO', 'WARN', 'DANGER'].includes(row?.level)) {
        throw new Error('ระดับการแจ้งเตือนไม่ถูกต้อง')
      }
      if (typeof row?.message !== 'string' || row.message.trim().length === 0) {
        throw new Error('ต้องใส่ข้อความแจ้งเตือนทุกข้อ')
      }
    }
  }
}

export function parseSettingValue(value: string, valueType: SettingValueType): unknown {
  switch (valueType) {
    case 'INT':
      return Number.parseInt(value, 10)
    case 'FLOAT':
      return Number.parseFloat(value)
    case 'BOOLEAN':
      return value === 'true'
    case 'JSON':
      return JSON.parse(value)
    default:
      return value
  }
}

/** ตรวจว่าค่าที่ admin ส่งมา parse ได้จริงตาม type ที่ประกาศไว้ แล้วตรวจกติกาเฉพาะ key ต่อ */
export function assertSettingValue(key: string, value: string, valueType: SettingValueType) {
  let parsed: unknown
  try {
    parsed = parseSettingValue(value, valueType)
  } catch {
    throw new Error('รูปแบบข้อมูลไม่ถูกต้อง')
  }
  if ((valueType === 'INT' || valueType === 'FLOAT') && !Number.isFinite(parsed as number)) {
    throw new Error(`ค่า "${value}" ไม่ใช่ตัวเลขที่ถูกต้อง`)
  }
  validateKnownSetting(key, value)
}
