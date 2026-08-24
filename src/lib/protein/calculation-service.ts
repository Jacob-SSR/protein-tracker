import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAudit } from '@/lib/audit'
import { formatDateOnly, tomorrow } from '@/lib/date'
import { num, round2, toDecimal } from '@/lib/decimal'
import { badRequest, conflict } from '@/lib/errors'
import { previewProteinTarget } from './calculator'

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
  /** ค่าที่ admin เห็นตอน preview — ถ้าไม่ตรงกับที่คำนวณสดตอน confirm จะ reject */
  expectedProteinTargetGrams?: number | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Confirm เป้าหมายโปรตีนใหม่
 * - มีผล "วันถัดไป" เสมอ (ไม่มีวันไหนมีสอง target ซ้อนกัน)
 * - ปิดแถวเดิม + สร้างแถวใหม่ ในทรานแซคชันเดียว ไม่ overwrite ค่าเดิม
 */
export async function confirmProteinTarget(input: ConfirmInput) {
  const effectiveFrom = tomorrow()
  const preview = await previewProteinTarget(input.patientId, effectiveFrom)

  const selected = preview.selected
  const proteinFactor = preview.proteinFactor
  const proteinTargetGrams = preview.proteinTargetGrams

  if (!selected || proteinFactor === null || proteinTargetGrams === null) {
    throw badRequest(
      'NO_MATCHING_RULE',
      'ไม่มีกฎคำนวณโปรตีนข้อไหนตรงกับข้อมูลผู้ป่วยรายนี้ กรุณาตรวจสอบกฎหรือข้อมูลสุขภาพ',
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
        ruleId: selected.ruleId,
        ruleVersion: selected.ruleVersion,
        ruleNameSnapshot: selected.ruleName,
        referenceWeightKg: toDecimal(preview.referenceWeightKg),
        proteinFactor: toDecimal(proteinFactor),
        proteinTargetGrams: toDecimal(proteinTargetGrams),
        inputSnapshot: {
          facts: preview.facts,
          selectedRule: selected,
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
        proteinTargetGrams,
        proteinFactor,
        effectiveFrom: formatDateOnly(effectiveFrom),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })

    return {
      id: created.id,
      proteinTargetGrams,
      proteinFactor,
      referenceWeightKg: preview.referenceWeightKg,
      effectiveFrom: formatDateOnly(effectiveFrom),
      previousId: active?.id ?? null,
    }
  })
}
