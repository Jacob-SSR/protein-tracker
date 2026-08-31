import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAudit } from '@/lib/audit'
import { formatDateOnly, today } from '@/lib/date'
import { num, round2, toDecimal } from '@/lib/decimal'
import { badRequest, conflict } from '@/lib/errors'
import { previewProteinTarget } from './calculator'
import type { WeightBasis } from '@prisma/client'

/**
 * ล็อกแถว patient ก่อนแตะ ProteinCalculation
 *
 * นี่คือแนวป้องกันหลักของกติกา "active calculation ต้องมีแถวเดียวต่อผู้ป่วย"
 * partial unique index ของ Postgres เป็นแค่ตาข่ายชั้นสอง เพราะ MySQL ไม่มี
 * ตอนย้าย provider: เปลี่ยนแค่การ quote ชื่อตาราง ("Patient" -> `Patient`) ตรงนี้ที่เดียว
 */
async function lockPatientRow(tx: Prisma.TransactionClient, patientId: string) {
  await tx.$queryRaw`SELECT id FROM "Patient" WHERE id = ${patientId} FOR UPDATE`
}

export type ConfirmInput = {
  patientId: string
  confirmedById: string
  note?: string | null
  /** ค่าที่คนกดเห็นตอน preview — ถ้าไม่ตรงกับที่คำนวณสดตอน confirm จะ reject */
  expectedProteinTargetGrams?: number | null
  /** ฐานน้ำหนักที่เลือกไว้บนหน้า preview — ไม่ส่ง = ใช้ฐานที่กฎกำหนด */
  weightBasis?: WeightBasis | null
  /** พลังงานต่อน้ำหนักตัว 1 kg ที่เลือกไว้ */
  energyFactorKcal?: number | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Confirm เป้าหมายโปรตีนใหม่
 * - มีผล "วันนี้" ทันที ผู้ป่วยกรอกข้อมูลเสร็จแล้วใช้ได้เลย ไม่ต้องรอข้ามวัน
 * - ยังไม่มีวันไหนที่มีสอง target ซ้อนกัน เพราะปิดแถวเดิมด้วย effectiveTo = วันนี้
 *   และ getCalculationForDate นับ effectiveTo แบบไม่รวมวันนั้น (gt: date)
 * - ปิดแถวเดิม + สร้างแถวใหม่ ในทรานแซคชันเดียว ไม่ overwrite ค่าเดิม
 */
export async function confirmProteinTarget(input: ConfirmInput) {
  const effectiveFrom = today()
  const preview = await previewProteinTarget(input.patientId, effectiveFrom, {
    weightBasis: input.weightBasis,
    energyFactorKcal: input.energyFactorKcal,
  })

  const selected = preview.selected
  const proteinFactor = preview.proteinFactor
  const proteinTargetGrams = preview.proteinTargetGrams
  const referenceWeightKg = preview.referenceWeightKg
  const weightBasis = preview.weightBasis ?? 'IBW'
  const gramsRange = preview.guideline.gramsRange
  const factorRange = preview.guideline.factorRange

  // ช่วงโปรตีนมาจากแนวทาง ไม่ได้มาจากกฎใน DB — ไม่รู้ระยะไตก็บอกช่วงไม่ได้
  if (!factorRange || proteinFactor === null) {
    throw badRequest(
      'NO_GUIDELINE_RANGE',
      preview.blockedReason ??
        'ยังบอกช่วงโปรตีนไม่ได้ ต้องรู้ระยะโรคไตก่อน (กรอก eGFR หรือ Creatinine)',
    )
  }

  // ข้อมูลไม่พอคำนวณฐานน้ำหนัก (เช่น ใช้ IBW แต่ไม่มีส่วนสูงหรือไม่ระบุเพศ)
  if (proteinTargetGrams === null || referenceWeightKg === null) {
    throw badRequest(
      'MISSING_WEIGHT_BASIS_DATA',
      preview.blockedReason ?? 'ข้อมูลไม่พอสำหรับคำนวณเป้าหมาย',
    )
  }

  if (
    input.expectedProteinTargetGrams != null &&
    round2(input.expectedProteinTargetGrams) !== proteinTargetGrams
  ) {
    throw conflict(
      'PREVIEW_STALE',
      'ข้อมูลเปลี่ยนไปหลังจากกด Preview กรุณากด Preview ใหม่อีกครั้งก่อนยืนยัน',
    )
  }

  return prisma.$transaction(async (tx) => {
    await lockPatientRow(tx, input.patientId)

    const active = await tx.proteinCalculation.findFirst({
      where: { patientId: input.patientId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    })

    if (active) {
      // ถ้าแถวเดิมยังไม่เริ่มมีผล (confirm ซ้ำในวันเดียวกัน) ปิดด้วย effectiveTo = effectiveFrom
      // จะได้ช่วงว่างเปล่าที่ไม่มีวันไหน match — เก็บไว้เป็นประวัติ ไม่ลบทิ้ง
      const closeAt = active.effectiveFrom > effectiveFrom ? active.effectiveFrom : effectiveFrom
      await tx.proteinCalculation.update({
        where: { id: active.id },
        data: { effectiveTo: closeAt },
      })
    }

    const created = await tx.proteinCalculation.create({
      data: {
        patientId: input.patientId,
        ruleId: selected?.ruleId ?? null,
        ruleVersion: selected?.ruleVersion ?? null,
        ruleNameSnapshot: selected?.ruleName ?? preview.guideline.basisLabel,
        weightBasis,
        referenceWeightKg: toDecimal(referenceWeightKg),
        proteinFactorMin: toDecimal(factorRange.min),
        proteinTargetGramsMin: gramsRange === null ? null : toDecimal(gramsRange.min),
        proteinFactor: toDecimal(proteinFactor),
        proteinTargetGrams: toDecimal(proteinTargetGrams),
        guidelineGroup: preview.guideline.group,
        energyFactorKcal: preview.energyFactorKcal ?? null,
        energyTargetKcal:
          preview.energyTargetKcal === null ? null : toDecimal(preview.energyTargetKcal),
        ckdStageCode: preview.ckd?.code ?? null,
        egfr: preview.ckd?.egfr == null ? null : toDecimal(preview.ckd.egfr),
        waterTargetMl: preview.water?.targetMl ?? null,
        inputSnapshot: {
          facts: preview.facts,
          selectedRule: selected,
          guideline: preview.guideline,
          weightBasisSource: preview.weightBasisSource,
          suggestedWeightBasis: preview.suggestedWeightBasis,
          ckd: preview.ckd,
          water: preview.water,
        } as unknown as Prisma.InputJsonValue,
        note: input.note ?? null,
        effectiveFrom,
        confirmedById: input.confirmedById,
      },
    })

    await writeAudit(tx, {
      actorId: input.confirmedById,
      action: 'PROTEIN_TARGET_CONFIRM',
      targetType: 'ProteinCalculation',
      targetId: created.id,
      oldValue: active
        ? {
            id: active.id,
            proteinTargetGrams: num(active.proteinTargetGrams),
            effectiveFrom: formatDateOnly(active.effectiveFrom),
          }
        : undefined,
      newValue: {
        id: created.id,
        proteinTargetGramsMin: gramsRange?.min ?? null,
        proteinTargetGrams,
        proteinFactor,
        guidelineGroup: preview.guideline.group,
        weightBasis,
        energyTargetKcal: preview.energyTargetKcal,
        ckdStageCode: preview.ckd?.code ?? null,
        effectiveFrom: formatDateOnly(effectiveFrom),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })

    return {
      id: created.id,
      proteinTargetGramsMin: gramsRange?.min ?? null,
      proteinTargetGrams,
      proteinFactor,
      referenceWeightKg,
      weightBasis,
      energyTargetKcal: preview.energyTargetKcal,
      waterTargetMl: preview.water?.targetMl ?? null,
      ckdStageCode: preview.ckd?.code ?? null,
      effectiveFrom: formatDateOnly(effectiveFrom),
      previousId: active?.id ?? null,
    }
  })
}
