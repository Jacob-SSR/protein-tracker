import type { Gender, WeightBasis } from '@prisma/client'

/**
 * สูตรร่างกาย/ระยะไต ทั้งหมดอยู่ในไฟล์นี้ไฟล์เดียว
 *
 * ตั้งใจไม่ import อะไรที่เป็น runtime (prisma, decimal.ts) เพราะไฟล์นี้ถูกใช้ทั้ง
 * ฝั่ง server (คำนวณจริงตอน confirm) และฝั่ง client (โชว์ค่าสดๆ ระหว่างผู้ป่วยพิมพ์)
 * ต้องได้ผลตรงกันเป๊ะทั้งสองฝั่ง
 */

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * น้ำหนักอุดมคติ (IBW)
 *   ชาย  = ส่วนสูง(ซม.) - 100
 *   หญิง = ส่วนสูง(ซม.) - 105
 * ต้องมีทั้งส่วนสูงและเพศชาย/หญิง — เพศ OTHER หรือไม่ระบุ คำนวณไม่ได้
 */
export function idealBodyWeightKg(
  heightCm: number | null | undefined,
  gender: Gender | null | undefined,
): number | null {
  if (!heightCm || heightCm <= 0) return null
  if (gender !== 'MALE' && gender !== 'FEMALE') return null
  const ibw = heightCm - (gender === 'MALE' ? 100 : 105)
  return ibw > 0 ? round(ibw) : null
}

/** BMI = น้ำหนัก(kg) / ส่วนสูง(m)^2 */
export function bmiOf(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || weightKg <= 0 || !heightCm || heightCm <= 0) return null
  return round(weightKg / (heightCm / 100) ** 2)
}

/** เกณฑ์เอเชีย-แปซิฟิก (ต่างจากเกณฑ์สากลตรงจุดตัดอ้วน 25 ไม่ใช่ 30) */
export function bmiCategory(bmi: number | null): string | null {
  if (bmi === null) return null
  if (bmi < 18.5) return 'น้ำหนักน้อย'
  if (bmi < 23) return 'ปกติ'
  if (bmi < 25) return 'น้ำหนักเกิน'
  if (bmi < 30) return 'อ้วนระดับ 1'
  return 'อ้วนระดับ 2'
}

/** BMI >= 30 ใช้ IBW + 0.25 x (จริง - IBW) ไม่ถึงใช้น้ำหนักจริง */
export function adjustedBodyWeightKg(
  actualKg: number,
  ibwKg: number | null,
  bmi: number | null,
): number | null {
  if (ibwKg === null) return null
  if (bmi === null || bmi < 30) return actualKg
  return round(ibwKg + 0.25 * (actualKg - ibwKg))
}

/**
 * eGFR สูตร CKD-EPI 2021 (ตัวที่ไม่ใช้เชื้อชาติแล้ว)
 *   142 x min(Scr/k, 1)^a x max(Scr/k, 1)^-1.200 x 0.9938^age x 1.012 (ถ้าเป็นหญิง)
 *   k = 0.7 หญิง / 0.9 ชาย     a = -0.241 หญิง / -0.302 ชาย
 * ต้องมีครบทั้ง Cr + อายุ + เพศชาย/หญิง ไม่งั้นคืน null
 */
export function estimateEgfr(input: {
  creatinineMgDl: number | null | undefined
  ageYears: number | null | undefined
  gender: Gender | null | undefined
}): number | null {
  const { creatinineMgDl, ageYears, gender } = input
  if (!creatinineMgDl || creatinineMgDl <= 0) return null
  if (ageYears === null || ageYears === undefined || ageYears < 0) return null
  if (gender !== 'MALE' && gender !== 'FEMALE') return null

  const female = gender === 'FEMALE'
  const kappa = female ? 0.7 : 0.9
  const alpha = female ? -0.241 : -0.302
  const ratio = creatinineMgDl / kappa

  const egfr =
    142 *
    Math.min(ratio, 1) ** alpha *
    Math.max(ratio, 1) ** -1.2 *
    0.9938 ** ageYears *
    (female ? 1.012 : 1)

  return round(egfr)
}

export type CkdStage = {
  /** 1-5 ใช้เทียบกับกฎ (ระยะ 3a และ 3b นับเป็น 3 เท่ากัน) */
  stage: number
  /** G1 / G2 / G3a / G3b / G4 / G5 */
  code: string
  label: string
  description: string
}

const CKD_STAGES: {
  min: number
  stage: number
  code: string
  label: string
  description: string
}[] = [
  { min: 90, stage: 1, code: 'G1', label: 'ระยะ 1', description: 'การทำงานของไตปกติ' },
  { min: 60, stage: 2, code: 'G2', label: 'ระยะ 2', description: 'ไตเสื่อมเล็กน้อย' },
  { min: 45, stage: 3, code: 'G3a', label: 'ระยะ 3a', description: 'ไตเสื่อมปานกลางค่อนไปทางน้อย' },
  { min: 30, stage: 3, code: 'G3b', label: 'ระยะ 3b', description: 'ไตเสื่อมปานกลางค่อนไปทางมาก' },
  { min: 15, stage: 4, code: 'G4', label: 'ระยะ 4', description: 'ไตเสื่อมมาก' },
  { min: 0, stage: 5, code: 'G5', label: 'ระยะ 5', description: 'ไตวายระยะสุดท้าย' },
]

export function ckdStageFromEgfr(egfr: number | null | undefined): CkdStage | null {
  if (egfr === null || egfr === undefined || !Number.isFinite(egfr) || egfr < 0) return null
  const row = CKD_STAGES.find((item) => egfr >= item.min)
  if (!row) return null
  return { stage: row.stage, code: row.code, label: row.label, description: row.description }
}

/**
 * ระยะ 3 ขึ้นไป = จำกัดโปรตีน ให้คูณด้วยน้ำหนักอุดมคติ ไม่ใช่น้ำหนักที่ชั่งได้
 * ระยะ 1-2 (ไตยังปกติ/เสื่อมน้อย) ใช้น้ำหนักตัวจริงของผู้ป่วยเอง
 * คืน null เมื่อยังไม่รู้ระยะ — ให้ไปใช้ฐานที่กฎกำหนดไว้แทน
 */
export function suggestedWeightBasis(stage: number | null | undefined): WeightBasis | null {
  if (stage === null || stage === undefined) return null
  return stage >= 3 ? 'IBW' : 'ACTUAL'
}

/** ตัวเลือกพลังงานต่อน้ำหนักตัว 1 kg ตามที่ใช้กันในคลินิกโรคไต */
export const ENERGY_FACTORS_KCAL = [20, 25, 30, 35, 40, 45] as const

export function energyTargetKcal(
  factorKcal: number | null | undefined,
  referenceWeightKg: number | null | undefined,
): number | null {
  if (!factorKcal || !referenceWeightKg) return null
  return round(factorKcal * referenceWeightKg)
}

/** ภาวะบวม — เก็บเป็น boolean ใน DB แต่ฝั่ง UI อยากได้คำไทย */
export const EDEMA_LABELS = { true: 'บวม', false: 'ไม่บวม' } as const
