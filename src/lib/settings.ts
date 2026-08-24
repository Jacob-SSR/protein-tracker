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
