import { prisma } from '@/lib/db/prisma'
import { formatDateOnly, today } from '@/lib/date'
import { num, round2 } from '@/lib/decimal'
import { notFound, badRequest } from '@/lib/errors'
import type { Gender } from '@prisma/client'
import {
  resolveReferenceWeight,
  selectRule,
  WEIGHT_BASIS_LABELS,
  type PatientFacts,
  type RuleEvaluation,
} from './rules'
import type { WeightBasis } from '@prisma/client'

export type ProteinPreview = {
  patientId: string
  facts: PatientFacts
  evaluations: RuleEvaluation[]
  selected: RuleEvaluation | null
  /** น้ำหนักที่ถูกนำไปคูณจริงตามฐานของกฎที่เลือก */
  referenceWeightKg: number | null
  weightBasis: WeightBasis | null
  weightBasisLabel: string | null
  /** เหตุผลที่คำนวณไม่ได้ เช่น กฎใช้ IBW แต่ไม่มีส่วนสูง */
  blockedReason: string | null
  proteinFactor: number | null
  proteinTargetGrams: number | null
  /** วันที่เป้าหมายใหม่จะเริ่มมีผล (พรุ่งนี้เสมอ) */
  effectiveFrom: string
  current: {
    id: string
    proteinTargetGrams: number
    proteinFactor: number
    effectiveFrom: string
  } | null
}

/**
 * น้ำหนักอุดมคติ สูตร Devine
 *   ชาย   50   + 2.3 x (ส่วนสูงเป็นนิ้ว - 60)
 *   หญิง  45.5 + 2.3 x (ส่วนสูงเป็นนิ้ว - 60)
 * ต้องมีทั้งส่วนสูงและเพศชาย/หญิง — เพศ OTHER หรือไม่ระบุ คำนวณไม่ได้
 */
function idealBodyWeight(heightCm: number | null, gender: Gender | null): number | null {
  if (!heightCm || (gender !== 'MALE' && gender !== 'FEMALE')) return null
  const inches = heightCm / 2.54
  const base = gender === 'MALE' ? 50 : 45.5
  const ibw = base + 2.3 * (inches - 60)
  // คนตัวเล็กมากสูตรนี้ให้ค่าติดลบได้ ตัดพื้นไว้ที่ 30 kg กันค่าประหลาด
  return round2(Math.max(ibw, 30))
}

/** BMI >= 30 ใช้ IBW + 0.25 x (จริง - IBW) ไม่ถึงใช้น้ำหนักจริง */
function adjustedBodyWeight(
  actualKg: number,
  ibwKg: number | null,
  bmi: number | null,
): number | null {
  if (ibwKg === null) return null
  if (bmi === null || bmi < 30) return actualKg
  return round2(ibwKg + 0.25 * (actualKg - ibwKg))
}

function ageInYears(birthDate: Date | null, asOf: Date): number | null {
  if (!birthDate) return null
  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear()
  const beforeBirthday =
    asOf.getUTCMonth() < birthDate.getUTCMonth() ||
    (asOf.getUTCMonth() === birthDate.getUTCMonth() && asOf.getUTCDate() < birthDate.getUTCDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

/** รวบรวมข้อมูลล่าสุด ณ วันที่ asOf มาเป็นชุดเดียว (ตัวนี้คือของที่จะถูก snapshot ลง DB) */
export async function buildPatientFacts(patientId: string, asOf: Date): Promise<PatientFacts> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      measurements: {
        where: { measuredOn: { lte: asOf } },
        orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
      labs: {
        where: { measuredOn: { lte: asOf } },
        orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
      },
      comorbidities: {
        where: { isActive: true },
        include: { comorbidity: true },
      },
    },
  })

  if (!patient) throw notFound('ไม่พบผู้ป่วยรายนี้')

  const measurement = patient.measurements[0]
  if (!measurement) {
    throw badRequest('NO_MEASUREMENT', 'ผู้ป่วยยังไม่มีข้อมูลน้ำหนัก ไม่สามารถคำนวณเป้าหมายได้')
  }

  const weightKg = num(measurement.weightKg)
  const heightCm = measurement.heightCm ? num(measurement.heightCm) : null
  const bmi = heightCm && heightCm > 0 ? round2(weightKg / (heightCm / 100) ** 2) : null

  // ผลเลือด: เก็บเฉพาะแถวล่าสุดของแต่ละ labType (labs เรียง desc มาแล้ว)
  const labs: PatientFacts['labs'] = {}
  for (const lab of patient.labs) {
    const key = lab.labType.trim().toUpperCase()
    if (!labs[key]) {
      labs[key] = {
        value: num(lab.value),
        unit: lab.unit,
        measuredOn: formatDateOnly(lab.measuredOn),
      }
    }
  }

  const comorbidityCodes = patient.comorbidities.map((row) => row.comorbidity.code.toUpperCase())
  const ibwKg = idealBodyWeight(heightCm, patient.gender)

  return {
    patientId,
    asOf: formatDateOnly(asOf),
    ageYears: ageInYears(patient.birthDate, asOf),
    gender: patient.gender,
    weightKg,
    heightCm,
    bmi,
    ibwKg,
    adjustedWeightKg: adjustedBodyWeight(weightKg, ibwKg, bmi),
    labs,
    comorbidityCodes,
    isDialysis: comorbidityCodes.includes('DIALYSIS'),
  }
}

/**
 * Preview เท่านั้น — ห้ามเขียน ProteinCalculation ลง DB ในฟังก์ชันนี้
 * การบันทึกจริงอยู่ที่ confirmProteinTarget() ใน calculation-service.ts
 */
export async function previewProteinTarget(
  patientId: string,
  effectiveFrom: Date,
): Promise<ProteinPreview> {
  const facts = await buildPatientFacts(patientId, today())

  const rules = await prisma.proteinRule.findMany({
    where: { isActive: true },
    include: { conditions: true },
  })

  const { evaluations, selected } = selectRule(
    facts,
    rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      version: rule.version,
      priority: rule.priority,
      weightBasis: rule.weightBasis,
      conditions: rule.conditions,
    })),
  )

  const current = await getActiveCalculation(patientId)

  const proteinFactor = selected?.proteinFactor ?? null
  // น้ำหนักที่คูณขึ้นกับฐานที่กฎกำหนด ไม่ใช่น้ำหนักที่ชั่งได้เสมอไป
  const reference = selected
    ? resolveReferenceWeight(facts, selected.weightBasis)
    : { weightKg: null, reason: undefined }
  const proteinTargetGrams =
    proteinFactor === null || reference.weightKg === null
      ? null
      : round2(proteinFactor * reference.weightKg)

  return {
    patientId,
    facts,
    evaluations,
    selected,
    referenceWeightKg: reference.weightKg,
    weightBasis: selected?.weightBasis ?? null,
    weightBasisLabel: selected ? WEIGHT_BASIS_LABELS[selected.weightBasis] : null,
    blockedReason: reference.reason ?? null,
    proteinFactor,
    proteinTargetGrams,
    effectiveFrom: formatDateOnly(effectiveFrom),
    current: current
      ? {
          id: current.id,
          proteinTargetGrams: num(current.proteinTargetGrams),
          proteinFactor: num(current.proteinFactor),
          effectiveFrom: formatDateOnly(current.effectiveFrom),
        }
      : null,
  }
}

/** เป้าหมายที่ใช้อยู่ตอนนี้ (แถวที่ยังไม่ถูกปิด) */
export function getActiveCalculation(patientId: string) {
  return prisma.proteinCalculation.findFirst({
    where: { patientId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  })
}

/** เป้าหมายที่มีผลของ "วันนั้น" — effectiveFrom <= วัน แล้วเอาแถวบนสุด */
export async function getCalculationForDate(patientId: string, date: Date) {
  return prisma.proteinCalculation.findFirst({
    where: {
      patientId,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  })
}
