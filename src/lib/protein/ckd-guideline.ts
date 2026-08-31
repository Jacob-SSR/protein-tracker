/**
 * แนวทางกำหนดโปรตีนและพลังงานสำหรับผู้ป่วยโรคไต ตามตารางที่โรงพยาบาลให้มา
 *
 * สองข้อที่เป็นหัวใจของตารางนี้
 *   1. โปรตีนเป็น "ช่วง" ไม่ใช่ตัวเลขเดียว — แนวทางระบุมาเป็นช่วงจริงๆ
 *      การเลือกจุดใดจุดหนึ่งในช่วงเป็นดุลพินิจของนักกำหนดอาหาร ระบบไม่ตัดสินแทน
 *   2. ทั้งโปรตีนและพลังงานคูณด้วย "น้ำหนักที่ควรจะเป็น" (IBW) ไม่ใช่น้ำหนักที่ชั่งได้
 *
 * ไฟล์นี้ไม่มี dependency อะไรเลย ใช้ได้ทั้งฝั่ง server และ client ผลจะได้ตรงกัน
 */

export type ProteinRange = { min: number; max: number }

/**
 * กลุ่มที่ใช้เลือกช่วงโปรตีน เรียงตามความสำคัญ (บนสุดชนะ)
 *   PEW       — ภาวะสูญเสียโปรตีนและพลังงาน ต้องการโปรตีนสูงสุด
 *   ESRD_RISK — เสี่ยงดำเนินไปเป็นไตวายระยะสุดท้าย
 *   STANDARD  — โรคไตทั่วไป (เป็นเบาหวานร่วมหรือไม่ ตารางให้ช่วงเท่ากัน)
 */
export type GuidelineGroup = 'PEW' | 'ESRD_RISK' | 'STANDARD'

export const GUIDELINE_GROUP_LABELS: Record<GuidelineGroup, string> = {
  PEW: 'ภาวะสูญเสียโปรตีนและพลังงาน (PEW)',
  ESRD_RISK: 'เสี่ยงดำเนินไปเป็นไตวายระยะสุดท้าย',
  STANDARD: 'โรคไตทั่วไป',
}

/** รหัสโรคร่วมที่ทำให้ข้ามไปใช้ช่วงของกลุ่มพิเศษ */
export const PEW_CODE = 'PEW'
export const ESRD_RISK_CODE = 'ESRD_RISK'

export function guidelineGroupFrom(comorbidityCodes: string[]): GuidelineGroup {
  if (comorbidityCodes.includes(PEW_CODE)) return 'PEW'
  if (comorbidityCodes.includes(ESRD_RISK_CODE)) return 'ESRD_RISK'
  return 'STANDARD'
}

/**
 * ช่วงโปรตีนต่อน้ำหนัก (ที่ควรจะเป็น) 1 กก.
 *
 * ระยะ 1-2  : 0.8-1.0 ก./กก.   (ไตยังทำงานได้ดี ไม่ต้องจำกัด)
 * ระยะ 3-5  : 0.6-0.8 ก./กก.   (จำกัดโปรตีนเพื่อชะลอความเสื่อม)
 * เสี่ยง ESRD: 1.0-1.3 ก./กก.
 * PEW       : 1.0-2.5 ก./กก.   (ใช้ได้ทุกระยะ เพราะเป็นภาวะขาดสารอาหาร)
 *
 * กลุ่มพิเศษไม่ขึ้นกับระยะไต จึงคืนค่าได้แม้ยังไม่รู้ระยะ
 * กลุ่มทั่วไปต้องรู้ระยะก่อน ไม่รู้ = คืน null ไม่เดาให้
 */
export function proteinRangePerKg(
  ckdStage: number | null | undefined,
  group: GuidelineGroup,
): ProteinRange | null {
  if (group === 'PEW') return { min: 1, max: 2.5 }
  if (group === 'ESRD_RISK') return { min: 1, max: 1.3 }
  if (ckdStage === null || ckdStage === undefined) return null
  return ckdStage >= 3 ? { min: 0.6, max: 0.8 } : { min: 0.8, max: 1 }
}

/** อายุที่เปลี่ยนจาก 35 เป็น 30 kcal ต่อน้ำหนัก (ที่ควรจะเป็น) 1 กก. */
export const ENERGY_AGE_CUTOFF = 60

/** พลังงานต่อน้ำหนัก 1 กก. ตามอายุ — ไม่รู้อายุคืน null ไม่เดาให้ */
export function energyFactorForAge(ageYears: number | null | undefined): number | null {
  if (ageYears === null || ageYears === undefined || !Number.isFinite(ageYears)) return null
  return ageYears < ENERGY_AGE_CUTOFF ? 35 : 30
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** คูณช่วงโปรตีนด้วยน้ำหนักที่ควรจะเป็น ได้เป็นช่วงกรัมต่อวัน */
export function proteinGramsRange(
  range: ProteinRange | null,
  referenceWeightKg: number | null,
): ProteinRange | null {
  if (!range || referenceWeightKg === null || referenceWeightKg <= 0) return null
  return { min: round2(range.min * referenceWeightKg), max: round2(range.max * referenceWeightKg) }
}

/** ข้อความอธิบายที่มาของช่วง ใช้โชว์ใต้ตัวเลขให้เจ้าหน้าที่ตรวจสอบได้ */
export function guidelineBasisLabel(group: GuidelineGroup, ckdStageLabel: string | null): string {
  if (group === 'STANDARD') return ckdStageLabel ? `โรคไต${ckdStageLabel}` : 'โรคไต'
  return GUIDELINE_GROUP_LABELS[group]
}
