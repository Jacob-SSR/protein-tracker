import type { ConditionOperator, ConditionType, Gender, Prisma, WeightBasis } from '@prisma/client'
import { num } from '@/lib/decimal'

/**
 * Rule engine ระดับ threshold (AND ล้วน) ตามที่ตกลงไว้
 * nested condition / OR ยังไม่ทำจนกว่าจะเห็น rule จริงจากฝั่งโรงพยาบาล
 */

export type PatientFacts = {
  patientId: string
  /** วันที่ใช้เป็นฐานในการดึงข้อมูล (YYYY-MM-DD) */
  asOf: string
  ageYears: number | null
  gender: Gender | null
  /** น้ำหนักที่ชั่งได้จริงล่าสุด */
  weightKg: number
  heightCm: number | null
  bmi: number | null
  /** น้ำหนักอุดมคติ (Devine) — null เมื่อไม่มีส่วนสูงหรือไม่ระบุเพศชาย/หญิง */
  ibwKg: number | null
  /** BMI >= 30 ใช้ IBW + 0.25 x (จริง - IBW), ไม่ถึงใช้น้ำหนักจริง — null เมื่อคำนวณ IBW ไม่ได้ */
  adjustedWeightKg: number | null
  /** ผลเลือดล่าสุดของแต่ละ labType (key เป็นตัวพิมพ์ใหญ่เสมอ) */
  labs: Record<string, { value: number; unit: string | null; measuredOn: string }>
  comorbidityCodes: string[]
  isDialysis: boolean
}

export type RuleConditionInput = {
  conditionType: ConditionType
  operator: ConditionOperator
  value: string
  proteinFactor: Prisma.Decimal | number | string
  sortOrder: number
}

export type RuleInput = {
  id: string
  name: string
  version: number
  priority: number
  weightBasis: WeightBasis
  conditions: RuleConditionInput[]
}

export type ConditionEvaluation = {
  conditionType: ConditionType
  operator: ConditionOperator
  expected: string
  actual: string | null
  matched: boolean
  reason?: string
}

export type RuleEvaluation = {
  ruleId: string
  ruleName: string
  ruleVersion: number
  priority: number
  weightBasis: WeightBasis
  matched: boolean
  proteinFactor: number | null
  conditions: ConditionEvaluation[]
}

const NUMERIC_TYPES: ConditionType[] = [
  'EGFR',
  'ALBUMIN',
  'BUN',
  'CREATININE',
  'POTASSIUM',
  'PHOSPHORUS',
  'BMI',
  'AGE',
  'WEIGHT',
  'CKD_STAGE',
]

function numericFact(facts: PatientFacts, type: ConditionType): number | null {
  switch (type) {
    case 'BMI':
      return facts.bmi
    case 'AGE':
      return facts.ageYears
    case 'WEIGHT':
      return facts.weightKg
    default:
      return facts.labs[type]?.value ?? null
  }
}

function compareNumber(actual: number, operator: ConditionOperator, expected: number): boolean {
  switch (operator) {
    case 'LT':
      return actual < expected
    case 'LTE':
      return actual <= expected
    case 'GT':
      return actual > expected
    case 'GTE':
      return actual >= expected
    case 'EQ':
      return actual === expected
    case 'NEQ':
      return actual !== expected
  }
}

export function evaluateCondition(
  facts: PatientFacts,
  condition: RuleConditionInput,
): ConditionEvaluation {
  const base = {
    conditionType: condition.conditionType,
    operator: condition.operator,
    expected: condition.value,
  }

  if (condition.conditionType === 'GENDER') {
    const expected = condition.value.toUpperCase()
    const same = facts.gender === expected
    if (!facts.gender) {
      return { ...base, actual: null, matched: false, reason: 'ผู้ป่วยยังไม่ได้ระบุเพศ' }
    }
    return {
      ...base,
      actual: facts.gender,
      matched: condition.operator === 'NEQ' ? !same : same,
    }
  }

  if (condition.conditionType === 'COMORBIDITY') {
    const has = facts.comorbidityCodes.includes(condition.value.toUpperCase())
    const matched = condition.operator === 'NEQ' ? !has : has
    return { ...base, actual: has ? 'HAS' : 'NONE', matched }
  }

  if (condition.conditionType === 'DIALYSIS') {
    const expected = condition.value.toLowerCase() === 'true'
    const matched =
      condition.operator === 'NEQ' ? facts.isDialysis !== expected : facts.isDialysis === expected
    return { ...base, actual: String(facts.isDialysis), matched }
  }

  if (NUMERIC_TYPES.includes(condition.conditionType)) {
    const actual = numericFact(facts, condition.conditionType)
    const expected = Number.parseFloat(condition.value)
    if (actual === null) {
      return {
        ...base,
        actual: null,
        matched: false,
        reason: `ไม่มีข้อมูล ${condition.conditionType} ล่าสุดของผู้ป่วย`,
      }
    }
    if (!Number.isFinite(expected)) {
      return {
        ...base,
        actual: String(actual),
        matched: false,
        reason: 'ค่าในกฎไม่ใช่ตัวเลข',
      }
    }
    return {
      ...base,
      actual: String(actual),
      matched: compareNumber(actual, condition.operator, expected),
    }
  }

  return {
    ...base,
    actual: null,
    matched: false,
    reason: 'ไม่รองรับ conditionType นี้',
  }
}

/** กฎหนึ่งข้อจะ match ก็ต่อเมื่อ "ทุก" condition ผ่าน (AND ล้วน) */
export function evaluateRule(facts: PatientFacts, rule: RuleInput): RuleEvaluation {
  const conditions = [...rule.conditions].sort((a, b) => a.sortOrder - b.sortOrder)
  const results = conditions.map((condition) => evaluateCondition(facts, condition))
  const matched = results.length > 0 && results.every((result) => result.matched)
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleVersion: rule.version,
    priority: rule.priority,
    weightBasis: rule.weightBasis,
    matched,
    proteinFactor: conditions.length > 0 ? num(conditions[0].proteinFactor) : null,
    conditions: results,
  }
}

/** priority น้อยมาก่อน กฎแรกที่ match คือกฎที่ใช้ */
export function selectRule(facts: PatientFacts, rules: RuleInput[]) {
  const evaluations = [...rules]
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map((rule) => evaluateRule(facts, rule))
  return {
    evaluations,
    selected: evaluations.find((evaluation) => evaluation.matched) ?? null,
  }
}

/** น้ำหนักที่ต้องเอาไปคูณ ตามฐานที่กฎกำหนด — null = ข้อมูลไม่พอคำนวณฐานนั้น */
export function resolveReferenceWeight(
  facts: PatientFacts,
  weightBasis: WeightBasis,
): { weightKg: number | null; reason?: string } {
  if (weightBasis === 'ACTUAL') return { weightKg: facts.weightKg }

  if (facts.ibwKg === null) {
    return {
      weightKg: null,
      reason: 'กฎนี้ใช้น้ำหนักอุดมคติ ต้องมีทั้งส่วนสูงและเพศ (ชาย/หญิง) ของผู้ป่วยก่อน',
    }
  }

  return { weightKg: weightBasis === 'IBW' ? facts.ibwKg : facts.adjustedWeightKg }
}

export const WEIGHT_BASIS_LABELS: Record<WeightBasis, string> = {
  ACTUAL: 'น้ำหนักจริง',
  IBW: 'น้ำหนักอุดมคติ (IBW)',
  ADJUSTED: 'น้ำหนักปรับ (Adjusted BW)',
}
