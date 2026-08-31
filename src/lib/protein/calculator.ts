import { prisma } from '@/lib/db/prisma'
import { formatDateOnly, today } from '@/lib/date'
import { num } from '@/lib/decimal'
import { notFound, badRequest } from '@/lib/errors'
import {
  adjustedBodyWeightKg,
  bmiOf,
  ckdStageFromEgfr,
  energyTargetKcal,
  estimateEgfr,
  idealBodyWeightKg,
  suggestedWeightBasis,
  type CkdStage,
} from './body-metrics'
import {
  resolveReferenceWeight,
  selectRule,
  WEIGHT_BASIS_LABELS,
  type PatientFacts,
  type RuleEvaluation,
} from './rules'
import {
  energyFactorForAge,
  guidelineBasisLabel,
  guidelineGroupFrom,
  proteinGramsRange,
  proteinRangePerKg,
  type GuidelineGroup,
  type ProteinRange,
} from './ckd-guideline'
import { getWaterSettings } from '@/lib/settings'
import { computeWaterTarget, type WaterTarget } from '@/lib/water/target'
import type { WeightBasis } from '@prisma/client'

export type ProteinPreview = {
  patientId: string
  facts: PatientFacts
  evaluations: RuleEvaluation[]
  selected: RuleEvaluation | null
  /** น้ำหนักที่ถูกนำไปคูณจริงตามฐานที่เลือกใช้ */
  referenceWeightKg: number | null
  /** ฐานน้ำหนักที่ใช้จริงในการคำนวณรอบนี้ */
  weightBasis: WeightBasis | null
  weightBasisLabel: string | null
  /** ฐานมาจากไหน: กฎกำหนด / คนเลือกเอง */
  weightBasisSource: 'RULE' | 'MANUAL'
  /** ฐานที่ระบบแนะนำจากระยะไต — ระยะ 3 ขึ้นไปใช้ IBW, ระยะ 1-2 ใช้น้ำหนักจริง */
  suggestedWeightBasis: WeightBasis | null
  ckd: (CkdStage & { egfr: number | null; egfrSource: 'LAB' | 'ESTIMATED' | null }) | null
  /** เหตุผลที่คำนวณไม่ได้ เช่น ใช้ IBW แต่ไม่มีส่วนสูง */
  blockedReason: string | null
  /** ขอบบนของช่วง — ใช้เป็นเพดานเวลาเตือนว่าทานเกิน */
  proteinFactor: number | null
  proteinTargetGrams: number | null
  /** ช่วงที่แนวทางกำหนด (ต่อน้ำหนักที่ควรจะเป็น 1 กก. และเป็นกรัมต่อวัน) */
  guideline: {
    group: GuidelineGroup
    basisLabel: string
    factorRange: ProteinRange | null
    gramsRange: ProteinRange | null
  }
  energyFactorKcal: number | null
  energyTargetKcal: number | null
  /** เป้าหมายน้ำดื่มต่อวัน คิดจากน้ำหนักฐานเดียวกับโปรตีน */
  water: WaterTarget | null
  /** วันที่เป้าหมายใหม่จะเริ่มมีผล (พรุ่งนี้เสมอ) */
  effectiveFrom: string
  current: {
    id: string
    proteinTargetGrams: number
    proteinFactor: number
    energyTargetKcal: number | null
    effectiveFrom: string
  } | null
}

export type PreviewOptions = {
  /** ฐานน้ำหนักที่คนเลือกเอง — ไม่ส่งมา = ใช้ฐานที่กฎกำหนด */
  weightBasis?: WeightBasis | null
  /** พลังงานต่อน้ำหนักตัว 1 kg (20-45 kcal) */
  energyFactorKcal?: number | null
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
        take: 30,
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

  // น้ำดื่มย้ายไปอยู่ที่ WaterIntakeEntry แล้ว (บันทึกทีละแก้ว) ไม่อ่านคอลัมน์เก่าอีก
  const waterToday = await prisma.waterIntakeEntry.aggregate({
    where: { patientId, intakeDate: asOf },
    _sum: { amountMl: true },
  })

  const measurement = patient.measurements[0]
  if (!measurement) {
    throw badRequest('NO_MEASUREMENT', 'ผู้ป่วยยังไม่มีข้อมูลน้ำหนัก ไม่สามารถคำนวณเป้าหมายได้')
  }

  const weightKg = num(measurement.weightKg)
  // ส่วนสูง/น้ำหนักแห้ง/ภาวะบวม ไม่ได้กรอกทุกครั้ง — ถอยไปหาค่าล่าสุดที่เคยกรอกไว้
  const heightRow = patient.measurements.find((row) => row.heightCm !== null)
  const dryRow = patient.measurements.find((row) => row.dryWeightKg !== null)
  const edemaRow = patient.measurements.find((row) => row.hasEdema !== null)
  const heightCm = heightRow ? num(heightRow.heightCm) : null

  const bmi = bmiOf(weightKg, heightCm)

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
  const ibwKg = idealBodyWeightKg(heightCm, patient.gender)
  const ageYears = ageInYears(patient.birthDate, asOf)

  // ผลแล็บ eGFR ถ้าหมอส่งมาเองถือว่าแม่นกว่า ไม่มีค่อยคำนวณจาก Cr
  const labEgfr = labs.EGFR?.value ?? null
  const estimated = estimateEgfr({
    creatinineMgDl: labs.CREATININE?.value ?? labs.CR?.value ?? null,
    ageYears,
    gender: patient.gender,
  })
  const egfr = labEgfr ?? estimated
  const stage = ckdStageFromEgfr(egfr)

  return {
    patientId,
    asOf: formatDateOnly(asOf),
    ageYears,
    gender: patient.gender,
    weightKg,
    heightCm,
    bmi,
    ibwKg,
    adjustedWeightKg: adjustedBodyWeightKg(weightKg, ibwKg, bmi),
    dryWeightKg: dryRow ? num(dryRow.dryWeightKg) : null,
    hasEdema: edemaRow?.hasEdema ?? null,
    waterIntakeMl: waterToday._sum.amountMl ?? null,
    egfr,
    egfrSource: egfr === null ? null : labEgfr !== null ? 'LAB' : 'ESTIMATED',
    ckdStage: stage?.stage ?? null,
    ckdStageCode: stage?.code ?? null,
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
  options: PreviewOptions = {},
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

  const stage = ckdStageFromEgfr(facts.egfr)

  // แนวทางของโรงพยาบาลคิดจาก "น้ำหนักที่ควรจะเป็น" เสมอ ทั้งโปรตีนและพลังงาน
  // ฐานอื่นยังเลือกเองได้ถ้าเจ้าหน้าที่มีเหตุผล แต่ค่าตั้งต้นคือ IBW
  const group = guidelineGroupFrom(facts.comorbidityCodes)
  const factorRange = proteinRangePerKg(facts.ckdStage, group)
  const suggested = suggestedWeightBasis(facts.ckdStage)
  const weightBasis = options.weightBasis ?? 'IBW'
  const weightBasisSource = options.weightBasis ? 'MANUAL' : 'RULE'

  const reference = resolveReferenceWeight(facts, weightBasis)
  const gramsRange = proteinGramsRange(factorRange, reference.weightKg)
  // เพดานของช่วงคือค่าที่ระบบใช้เตือนว่าทานเกิน
  const proteinFactor = factorRange?.max ?? null
  const proteinTargetGrams = gramsRange?.max ?? null

  // พลังงานมาจากอายุตามตาราง: ต่ำกว่า 60 ปีคูณ 35, ตั้งแต่ 60 ปีคูณ 30
  // เจ้าหน้าที่ยังปรับเองได้ถ้าเคสไหนต้องการต่างจากนี้
  const energyFactor = options.energyFactorKcal ?? energyFactorForAge(facts.ageYears)
  const water = computeWaterTarget(
    {
      referenceWeightKg: reference.weightKg,
      ckdStage: facts.ckdStage,
      hasEdema: facts.hasEdema,
      isDialysis: facts.isDialysis,
    },
    await getWaterSettings(),
  )

  return {
    patientId,
    facts,
    evaluations,
    selected,
    referenceWeightKg: reference.weightKg,
    weightBasis,
    weightBasisLabel: weightBasis ? WEIGHT_BASIS_LABELS[weightBasis] : null,
    weightBasisSource,
    suggestedWeightBasis: suggested,
    ckd: stage ? { ...stage, egfr: facts.egfr, egfrSource: facts.egfrSource } : null,
    blockedReason:
      reference.reason ??
      (factorRange === null
        ? 'ยังไม่รู้ระยะโรคไต — กรอก eGFR หรือ Creatinine ก่อน ระบบถึงจะบอกช่วงโปรตีนได้'
        : null),
    proteinFactor,
    proteinTargetGrams,
    guideline: {
      group,
      basisLabel: guidelineBasisLabel(group, stage?.label ?? null),
      factorRange,
      gramsRange,
    },
    energyFactorKcal: energyFactor,
    energyTargetKcal: energyTargetKcal(energyFactor, reference.weightKg),
    water,
    effectiveFrom: formatDateOnly(effectiveFrom),
    current: current
      ? {
          id: current.id,
          proteinTargetGrams: num(current.proteinTargetGrams),
          proteinFactor: num(current.proteinFactor),
          energyTargetKcal: current.energyTargetKcal ? num(current.energyTargetKcal) : null,
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
