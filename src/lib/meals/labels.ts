import type { MealType } from '@prisma/client'

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'มื้อเช้า',
  LUNCH: 'มื้อกลางวัน',
  DINNER: 'มื้อเย็น',
  SNACK: 'ของว่าง',
}

export const MEAL_TYPES = Object.entries(MEAL_LABELS).map(([value, label]) => ({
  value: value as MealType,
  label,
}))
