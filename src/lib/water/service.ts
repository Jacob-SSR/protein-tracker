import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { currentHour, formatDateOnly, today } from '@/lib/date'
import { badRequest } from '@/lib/errors'
import { getCalculationForDate } from '@/lib/protein/calculator'
import { getWaterSettings } from '@/lib/settings'
import { computeWaterTarget, summarizeWaterProgress, type WaterTarget } from '@/lib/water/target'

/**
 * น้ำดื่มรายวัน — backend เป็นเจ้าของตัวเลขทั้งหมด ฝั่ง UI ไม่คำนวณเองเลย
 *
 * เป้าหมายมาจาก ProteinCalculation ที่มีผลของวันนั้น (waterTargetMl) ไม่ได้คิดสด
 * ทุกครั้ง ผู้ป่วยที่ยังไม่เคยประเมินสุขภาพจึงยังไม่มีเป้าหมาย — ตั้งใจให้เป็นแบบนั้น
 */

export type WaterReminder = {
  level: 'INFO' | 'WARN'
  message: string
}

export type WaterSummary = ReturnType<typeof summarizeWaterProgress> & {
  date: string
  glassSizeMl: number
  restricted: boolean
  restrictionReason: string | null
  /** true = ยังไม่เคยยืนยันผลประเมินสุขภาพ จึงยังไม่มีเป้าหมายน้ำ */
  needsAssessment: boolean
  /** ข้อความเตือนตอนใกล้หมดวัน — null เมื่อยังไม่ถึงเวลาเตือนหรือไม่ต้องเตือน */
  reminder: WaterReminder | null
}

/**
 * เตือนตอนใกล้หมดวันว่ายังดื่มไม่ครบ
 *
 * เตือนเฉพาะ "วันนี้" เท่านั้น — ย้อนดูวันเก่าไม่ต้องมาบอกให้ไปดื่มเพิ่ม ทำไม่ได้แล้ว
 * และ "ไม่เตือนผู้ป่วยที่ถูกจำกัดน้ำ" โดยตั้งใจ กลุ่มบวม/ระยะ 4-5/ฟอกไต
 * เป้าหมายคือเพดานที่ห้ามเกิน ดื่มน้อยกว่าเพดานไม่ใช่เรื่องผิด
 * ไปไล่ให้เขาดื่มเพิ่มจะกลายเป็นให้คำแนะนำที่อันตราย
 */
function buildReminder(input: {
  date: Date
  consumedMl: number
  target: WaterTarget | null
  reminderHour: number
}): WaterReminder | null {
  const { date, consumedMl, target, reminderHour } = input
  if (!target || target.restricted) return null
  if (formatDateOnly(date) !== formatDateOnly(today())) return null
  if (consumedMl >= target.targetMl) return null
  if (currentHour() < reminderHour) return null

  const missingMl = target.targetMl - consumedMl
  const missingGlasses = Math.ceil(missingMl / target.glassSizeMl)

  return {
    level: 'WARN',
    message: `วันนี้ดื่มน้ำยังไม่ครบเป้าหมาย เหลืออีก ${missingGlasses} แก้ว (${missingMl.toLocaleString('th-TH')} มล.) ดื่มให้ครบก่อนหมดวันนะ`,
  }
}

/**
 * เป้าหมายของวันนั้น อ่านจากผลประเมินที่ "มีผล" ของวันนั้น
 * แถวเก่าที่ยืนยันไว้ก่อนมีฟีเจอร์นี้จะไม่มี waterTargetMl — คำนวณย้อนให้จาก snapshot
 * ที่เก็บไว้แล้ว จะได้ไม่ต้องบังคับให้ทุกคนไปกดยืนยันใหม่
 */
async function resolveTarget(patientId: string, date: Date): Promise<WaterTarget | null> {
  const calculation = await getCalculationForDate(patientId, date)
  if (!calculation) return null

  const settings = await getWaterSettings()
  const snapshot = calculation.inputSnapshot as {
    facts?: { ckdStage?: number | null; hasEdema?: boolean | null; isDialysis?: boolean }
    water?: { restricted?: boolean; restrictionReason?: string | null }
  } | null

  if (calculation.waterTargetMl) {
    const targetMl = calculation.waterTargetMl
    return {
      targetMl,
      targetLiters: Math.round((targetMl / 1000) * 10) / 10,
      // ขนาดแก้วอ่านจาก setting ปัจจุบันเสมอ ปรับแล้วจำนวนแก้วขยับตามทันที
      glassSizeMl: settings.glassSizeMl,
      glassesPerDay: Math.ceil(targetMl / settings.glassSizeMl),
      // เหตุผลที่ถูกจำกัดน้ำอยู่ใน snapshot ตอนยืนยัน ต้องหยิบมาด้วย
      // ไม่งั้นพอยืนยันแล้วคำเตือนบนการ์ดจะหายไปเฉยๆ
      restricted: snapshot?.water?.restricted ?? false,
      restrictionReason: snapshot?.water?.restrictionReason ?? null,
    }
  }

  return computeWaterTarget(
    {
      referenceWeightKg: Number(calculation.referenceWeightKg),
      ckdStage: snapshot?.facts?.ckdStage ?? null,
      hasEdema: snapshot?.facts?.hasEdema ?? null,
      isDialysis: snapshot?.facts?.isDialysis ?? false,
    },
    settings,
  )
}

export async function getWaterSummary(patientId: string, date: Date): Promise<WaterSummary> {
  const [entries, target, settings] = await Promise.all([
    prisma.waterIntakeEntry.findMany({
      where: { patientId, intakeDate: date },
      select: { amountMl: true },
    }),
    resolveTarget(patientId, date),
    getWaterSettings(),
  ])

  const consumedMl = entries.reduce((total, entry) => total + entry.amountMl, 0)

  return {
    ...summarizeWaterProgress({ consumedMl, glassesConsumed: entries.length, target }),
    date: formatDateOnly(date),
    glassSizeMl: target?.glassSizeMl ?? settings.glassSizeMl,
    restricted: target?.restricted ?? false,
    restrictionReason: target?.restrictionReason ?? null,
    needsAssessment: target === null,
    reminder: buildReminder({
      date,
      consumedMl,
      target,
      reminderHour: settings.reminderHour,
    }),
  }
}

/**
 * เพิ่มน้ำหนึ่งแก้ว
 * clientToken กันการยิงซ้ำจากการกดรัวหรือ network retry — token เดิมส่งมาอีกครั้ง
 * จะไม่เกิดแถวใหม่ แต่ยังได้ยอดล่าสุดกลับไปตามปกติ
 */
export async function addGlass(input: {
  patientId: string
  date: Date
  createdById: string
  clientToken?: string | null
}): Promise<WaterSummary> {
  const settings = await getWaterSettings()

  try {
    await prisma.waterIntakeEntry.create({
      data: {
        patientId: input.patientId,
        intakeDate: input.date,
        amountMl: settings.glassSizeMl,
        clientToken: input.clientToken || null,
        createdById: input.createdById,
      },
    })
  } catch (error) {
    // P2002 = token ซ้ำ แปลว่าเป็น request เดิมที่ยิงมาอีกรอบ ไม่ใช่การกดครั้งใหม่
    const duplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    if (!duplicate) throw error
  }

  return getWaterSummary(input.patientId, input.date)
}

/** ถอยกลับหนึ่งแก้ว — ลบรายการล่าสุดของวันนั้น ไม่ยุ่งกับวันอื่น */
export async function undoGlass(input: { patientId: string; date: Date }): Promise<WaterSummary> {
  const latest = await prisma.waterIntakeEntry.findFirst({
    where: { patientId: input.patientId, intakeDate: input.date },
    orderBy: { createdAt: 'desc' },
  })
  if (!latest) throw badRequest('NO_WATER_ENTRY', 'วันนี้ยังไม่มีรายการน้ำให้ถอยกลับ')

  await prisma.waterIntakeEntry.delete({ where: { id: latest.id } })
  return getWaterSummary(input.patientId, input.date)
}
