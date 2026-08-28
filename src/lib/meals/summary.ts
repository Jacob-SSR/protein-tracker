import type { MealType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { addDays, eachDay, formatDateOnly, parseDateOnly, startOfWeek, today } from '@/lib/date'
import { num, round2 } from '@/lib/decimal'
import { getNotifyThresholds, type NotifyThreshold } from '@/lib/settings'
import { getCalculationForDate } from '@/lib/protein/calculator'

/**
 * พลังงานที่ทานไปแล้ววันนี้ เทียบกับเป้าหมายที่เจ้าหน้าที่กำหนดไว้
 *
 * นับเฉพาะรายการที่มีข้อมูล kcal — อาหารที่ยังไม่ได้ใส่พลังงานจะไม่ถูกเดาค่าให้
 * itemsWithoutEnergy บอกไปตรงๆ ว่ายอดนี้ยังไม่ครบกี่รายการ ผู้ป่วยจะได้ไม่เข้าใจผิดว่าทานน้อยกว่าจริง
 */
export type EnergySummary = {
  targetKcal: number | null
  consumedKcal: number
  remainingKcal: number | null
  percent: number | null
  itemsWithEnergy: number
  itemsWithoutEnergy: number
}

export type DailySummary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
  percent: number | null
  notification: NotifyThreshold | null
  energy: EnergySummary
  meals: {
    id: string
    mealType: MealType
    items: {
      id: string
      foodName: string
      unitName: string
      quantity: number
      proteinAmount: number
      energyKcal: number | null
    }[]
    subtotalGrams: number
    subtotalKcal: number
  }[]
}

function pickNotification(percent: number | null, thresholds: NotifyThreshold[]) {
  if (percent === null) return null
  return (
    [...thresholds]
      .sort((a, b) => b.percent - a.percent)
      .find((threshold) => percent >= threshold.percent) ?? null
  )
}

export async function getDailySummary(patientId: string, date: Date): Promise<DailySummary> {
  const [meals, calculation, thresholds] = await Promise.all([
    prisma.meal.findMany({
      where: { patientId, mealDate: date },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { mealType: 'asc' },
    }),
    getCalculationForDate(patientId, date),
    getNotifyThresholds(),
  ])

  const mealViews = meals
    .filter((meal) => meal.items.length > 0)
    .map((meal) => {
      const items = meal.items.map((item) => ({
        id: item.id,
        foodName: item.foodNameSnapshot,
        unitName: item.unitNameSnapshot,
        quantity: num(item.quantity),
        proteinAmount: num(item.proteinAmount),
        energyKcal: item.energyKcal === null ? null : num(item.energyKcal),
      }))
      return {
        id: meal.id,
        mealType: meal.mealType,
        items,
        subtotalGrams: round2(items.reduce((sum, item) => sum + item.proteinAmount, 0)),
        subtotalKcal: round2(items.reduce((sum, item) => sum + (item.energyKcal ?? 0), 0)),
      }
    })

  const consumedGrams = round2(mealViews.reduce((sum, meal) => sum + meal.subtotalGrams, 0))
  const targetGrams = calculation ? num(calculation.proteinTargetGrams) : null
  const percent =
    targetGrams && targetGrams > 0 ? round2((consumedGrams / targetGrams) * 100) : null

  const allItems = mealViews.flatMap((meal) => meal.items)
  const consumedKcal = round2(allItems.reduce((sum, item) => sum + (item.energyKcal ?? 0), 0))
  const targetKcal = calculation?.energyTargetKcal ? num(calculation.energyTargetKcal) : null

  return {
    date: formatDateOnly(date),
    energy: {
      targetKcal,
      consumedKcal,
      remainingKcal: targetKcal === null ? null : round2(targetKcal - consumedKcal),
      percent: targetKcal && targetKcal > 0 ? round2((consumedKcal / targetKcal) * 100) : null,
      itemsWithEnergy: allItems.filter((item) => item.energyKcal !== null).length,
      itemsWithoutEnergy: allItems.filter((item) => item.energyKcal === null).length,
    },
    targetGrams,
    consumedGrams,
    remainingGrams: targetGrams === null ? null : round2(targetGrams - consumedGrams),
    percent,
    notification: pickNotification(percent, thresholds),
    meals: mealViews,
  }
}

export type WeeklyVerdict = {
  level: 'OK' | 'WARN' | 'DANGER'
  headline: string
  detail: string
}

export type WeeklySummary = {
  from: string
  to: string
  days: { date: string; targetGrams: number | null; consumedGrams: number }[]
  averageConsumedGrams: number
  daysOverTarget: number
  daysUnderTarget: number
  daysWithoutRecord: number
  daysEvaluated: number
  verdict: WeeklyVerdict
}

/**
 * ตัดสินว่าสัปดาห์นี้ทานเหมาะสมหรือไม่
 * นับเฉพาะวันที่ผ่านมาแล้วและมีเป้าหมายกำกับ วันในอนาคตของสัปดาห์ไม่นับ
 * ผู้ป่วย CKD ทานเกินเป็นความเสี่ยงหลัก แต่ทานน้อยเกินไปก็เสี่ยงขาดสารอาหาร จึงเตือนทั้งสองทาง
 */
function judgeWeek(input: {
  daysEvaluated: number
  daysOverTarget: number
  daysUnderTarget: number
  daysWithoutRecord: number
}): WeeklyVerdict {
  // daysEvaluated นับ "วันที่ผ่านมาแล้วและมีเป้าหมายกำกับ" — เป็น 0 ได้กรณีเดียวคือยังไม่มีเป้าหมาย
  // บอกไปตรงๆ ว่าต้องทำอะไรต่อ ดีกว่าคำว่า "ยังประเมินไม่ได้" ที่ผู้ป่วยอ่านแล้วไม่รู้จะทำอะไร
  if (input.daysEvaluated === 0) {
    return {
      level: 'WARN',
      headline: 'ยังไม่มีเป้าหมาย',
      detail: 'กรอกข้อมูลสุขภาพแล้วกดยืนยันเป้าหมาย ระบบจะเริ่มประเมินให้ตั้งแต่วันนั้น',
    }
  }

  if (input.daysOverTarget >= 3) {
    return {
      level: 'DANGER',
      headline: 'ทานเกินเป้าหมายบ่อยเกินไป',
      detail: `เกินเป้าหมาย ${input.daysOverTarget} จาก ${input.daysEvaluated} วัน ควรปรึกษาเจ้าหน้าที่เพื่อปรับการทาน`,
    }
  }

  if (input.daysOverTarget > 0) {
    return {
      level: 'WARN',
      headline: 'เกินเป้าหมายบางวัน',
      detail: `เกินเป้าหมาย ${input.daysOverTarget} จาก ${input.daysEvaluated} วัน ที่เหลืออยู่ในเกณฑ์`,
    }
  }

  if (input.daysUnderTarget >= 3) {
    return {
      level: 'WARN',
      headline: 'ทานน้อยกว่าเป้าหมายหลายวัน',
      detail: `ได้โปรตีนต่ำกว่า 70% ของเป้าหมาย ${input.daysUnderTarget} จาก ${input.daysEvaluated} วัน เสี่ยงขาดสารอาหาร`,
    }
  }

  if (input.daysWithoutRecord >= 3) {
    return {
      level: 'WARN',
      headline: 'บันทึกไม่ครบ',
      detail: `มี ${input.daysWithoutRecord} วันที่ไม่ได้บันทึกอาหารเลย ผลประเมินอาจไม่ตรงความจริง`,
    }
  }

  return {
    level: 'OK',
    headline: 'การทานอยู่ในเกณฑ์เหมาะสม',
    detail: `อยู่ในเป้าหมายครบทั้ง ${input.daysEvaluated} วันที่ประเมินได้`,
  }
}

export async function getWeeklySummary(
  patientId: string,
  anyDayOfWeek: Date,
): Promise<WeeklySummary> {
  const from = startOfWeek(anyDayOfWeek)
  const to = addDays(from, 6)

  const [meals, calculations] = await Promise.all([
    prisma.meal.findMany({
      where: { patientId, mealDate: { gte: from, lte: to } },
      include: { items: true },
    }),
    prisma.proteinCalculation.findMany({
      where: {
        patientId,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    }),
  ])

  const consumedByDate = new Map<string, number>()
  for (const meal of meals) {
    const key = formatDateOnly(meal.mealDate)
    const total = meal.items.reduce((sum, item) => sum + num(item.proteinAmount), 0)
    consumedByDate.set(key, (consumedByDate.get(key) ?? 0) + total)
  }

  const days = eachDay(from, to).map((day) => {
    // แถวเรียง effectiveFrom desc อยู่แล้ว — แถวแรกที่ครอบวันนี้คือ target ของวันนั้น
    const calculation = calculations.find(
      (row) => row.effectiveFrom <= day && (row.effectiveTo === null || row.effectiveTo > day),
    )
    return {
      date: formatDateOnly(day),
      targetGrams: calculation ? num(calculation.proteinTargetGrams) : null,
      consumedGrams: round2(consumedByDate.get(formatDateOnly(day)) ?? 0),
    }
  })

  const totalConsumed = days.reduce((sum, day) => sum + day.consumedGrams, 0)
  const currentDay = today()

  // ประเมินเฉพาะวันที่ผ่านมาแล้วและมีเป้าหมายกำกับ
  const evaluated = days.filter(
    (day) => day.targetGrams !== null && parseDateOnly(day.date) <= currentDay,
  )
  const daysOverTarget = evaluated.filter((day) => day.consumedGrams > day.targetGrams!).length
  const daysUnderTarget = evaluated.filter(
    (day) => day.consumedGrams > 0 && day.consumedGrams < day.targetGrams! * 0.7,
  ).length
  const daysWithoutRecord = days.filter(
    (day) => day.consumedGrams === 0 && parseDateOnly(day.date) <= currentDay,
  ).length

  return {
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    days,
    averageConsumedGrams: round2(totalConsumed / days.length),
    daysOverTarget,
    daysUnderTarget,
    daysWithoutRecord,
    daysEvaluated: evaluated.length,
    verdict: judgeWeek({
      daysEvaluated: evaluated.length,
      daysOverTarget,
      daysUnderTarget,
      daysWithoutRecord,
    }),
  }
}
