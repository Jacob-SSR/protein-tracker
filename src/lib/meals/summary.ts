import { prisma } from '@/lib/db/prisma'
import { addDays, eachDay, formatDateOnly, startOfWeek } from '@/lib/date'
import { num, round2 } from '@/lib/decimal'
import { getNotifyThresholds, type NotifyThreshold } from '@/lib/settings'
import { getCalculationForDate } from '@/lib/protein/calculator'

export type DailySummary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
  percent: number | null
  notification: NotifyThreshold | null
  meals: {
    id: string
    mealType: string
    items: {
      id: string
      foodName: string
      unitName: string
      quantity: number
      proteinAmount: number
    }[]
    subtotalGrams: number
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

  const mealViews = meals.map((meal) => {
    const items = meal.items.map((item) => ({
      id: item.id,
      foodName: item.foodNameSnapshot,
      unitName: item.unitNameSnapshot,
      quantity: num(item.quantity),
      proteinAmount: num(item.proteinAmount),
    }))
    return {
      id: meal.id,
      mealType: meal.mealType,
      items,
      subtotalGrams: round2(items.reduce((sum, item) => sum + item.proteinAmount, 0)),
    }
  })

  const consumedGrams = round2(mealViews.reduce((sum, meal) => sum + meal.subtotalGrams, 0))
  const targetGrams = calculation ? num(calculation.proteinTargetGrams) : null
  const percent = targetGrams && targetGrams > 0 ? round2((consumedGrams / targetGrams) * 100) : null

  return {
    date: formatDateOnly(date),
    targetGrams,
    consumedGrams,
    remainingGrams: targetGrams === null ? null : round2(targetGrams - consumedGrams),
    percent,
    notification: pickNotification(percent, thresholds),
    meals: mealViews,
  }
}

export type WeeklySummary = {
  from: string
  to: string
  days: { date: string; targetGrams: number | null; consumedGrams: number }[]
  averageConsumedGrams: number
  daysOverTarget: number
}

export async function getWeeklySummary(patientId: string, anyDayOfWeek: Date): Promise<WeeklySummary> {
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

  return {
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    days,
    averageConsumedGrams: round2(totalConsumed / days.length),
    daysOverTarget: days.filter(
      (day) => day.targetGrams !== null && day.consumedGrams > day.targetGrams,
    ).length,
  }
}
