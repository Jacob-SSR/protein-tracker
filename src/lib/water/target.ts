/**
 * เป้าหมายน้ำดื่มต่อวัน
 *
 * ตัวเลขทั้งหมดเป็น SystemSetting ไม่ได้ฝังไว้ในโค้ด (water_ml_per_kg,
 * water_restricted_max_ml, water_glass_size_ml) โรงพยาบาลปรับเองได้
 *
 * ค่าตั้งต้น 30 มล./กก./วัน และเพดาน 1,000 มล. สำหรับผู้ที่ต้องจำกัดน้ำ
 * เป็นค่ากลางๆ ที่ใช้กันทั่วไปเท่านั้น ไม่ใช่แนวทางของโรงพยาบาลใดโรงพยาบาลหนึ่ง
 * ควรให้นักกำหนดอาหาร/แพทย์ยืนยันตัวเลขก่อนใช้จริง
 */

export type WaterTargetInput = {
  /** น้ำหนักฐานเดียวกับที่ใช้คูณโปรตีน */
  referenceWeightKg: number | null
  ckdStage: number | null
  hasEdema: boolean | null
  isDialysis: boolean
}

export type WaterTargetSettings = {
  glassSizeMl: number
  mlPerKg: number
  restrictedMaxMl: number
}

export type WaterTarget = {
  targetMl: number
  targetLiters: number
  glassSizeMl: number
  glassesPerDay: number
  /** true = ถูกจำกัดน้ำ ไม่ได้ใช้สูตรตามน้ำหนักตรงๆ */
  restricted: boolean
  /** เหตุผลที่ถูกจำกัด — null เมื่อไม่ได้จำกัด */
  restrictionReason: string | null
}

/** ปัดเป็นหลัก 50 มล. ให้เป็นเลขที่คนอ่านแล้วจำง่าย */
function round50(value: number): number {
  return Math.round(value / 50) * 50
}

/**
 * ผู้ป่วยที่ต้องจำกัดน้ำ: มีภาวะบวม, ไตระยะ 4-5, หรือฟอกไต
 * กลุ่มนี้ดื่มตามสูตรน้ำหนักไม่ได้ ต้องใช้เพดานแทน
 */
function restrictionOf(input: WaterTargetInput): string | null {
  if (input.hasEdema) return 'มีภาวะบวม'
  if (input.isDialysis) return 'ฟอกไต'
  if (input.ckdStage !== null && input.ckdStage >= 4) return `โรคไตระยะ ${input.ckdStage}`
  return null
}

export function computeWaterTarget(
  input: WaterTargetInput,
  settings: WaterTargetSettings,
): WaterTarget | null {
  if (!input.referenceWeightKg || input.referenceWeightKg <= 0) return null

  const restrictionReason = restrictionOf(input)
  const base = round50(settings.mlPerKg * input.referenceWeightKg)
  const targetMl = restrictionReason ? Math.min(base, settings.restrictedMaxMl) : base

  return {
    targetMl,
    targetLiters: Math.round((targetMl / 1000) * 10) / 10,
    glassSizeMl: settings.glassSizeMl,
    // ปัดขึ้น — ดื่มไม่ครบแก้วสุดท้ายดีกว่าตั้งเป้าต่ำกว่าที่ควรได้
    glassesPerDay: Math.ceil(targetMl / settings.glassSizeMl),
    restricted: restrictionReason !== null,
    restrictionReason,
  }
}

/** แปลงยอดที่ดื่มไปแล้วเป็นตัวเลขที่ UI ใช้โชว์ ให้ backend เป็นคนคิดที่เดียว */
export function summarizeWaterProgress(input: {
  consumedMl: number
  glassesConsumed: number
  target: WaterTarget | null
}) {
  const { consumedMl, glassesConsumed, target } = input
  if (!target) {
    return {
      consumedMl,
      glassesConsumed,
      targetMl: null,
      glassesPerDay: null,
      percent: null,
      remainingMl: null,
      status: 'NO_TARGET' as const,
    }
  }

  const percent = target.targetMl > 0 ? Math.round((consumedMl / target.targetMl) * 1000) / 10 : 0
  return {
    consumedMl,
    glassesConsumed,
    targetMl: target.targetMl,
    glassesPerDay: target.glassesPerDay,
    percent,
    remainingMl: Math.max(target.targetMl - consumedMl, 0),
    status: (consumedMl > target.targetMl
      ? 'OVER'
      : consumedMl >= target.targetMl
        ? 'DONE'
        : 'IN_PROGRESS') as 'OVER' | 'DONE' | 'IN_PROGRESS',
  }
}
