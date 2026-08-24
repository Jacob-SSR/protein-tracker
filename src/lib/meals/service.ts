import { Prisma, type MealType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAudit } from '@/lib/audit'
import { addDays, diffDays, formatDateOnly, today } from '@/lib/date'
import { num, round2, toDecimal } from '@/lib/decimal'
import { badRequest, notFound } from '@/lib/errors'
import { getMealBackdateDays, getMealFutureDays } from '@/lib/settings'

/**
 * ตรวจสิทธิ์บันทึกย้อนหลังที่ service layer (ไม่ hardcode เป็น DB constraint)
 * meal_backdate_days: -1 = ไม่จำกัด, 0 = วันนี้เท่านั้น, n = ย้อนหลังได้ n วัน
 */
export async function assertMealDateAllowed(mealDate: Date) {
  const backdateDays = await getMealBackdateDays()
  const futureDays = await getMealFutureDays()
  const currentDay = today()

  if (diffDays(currentDay, mealDate) > futureDays) {
    throw badRequest(
      'MEAL_DATE_FUTURE',
      futureDays === 0
        ? 'ไม่สามารถบันทึกอาหารล่วงหน้าได้'
        : `บันทึกล่วงหน้าได้ไม่เกิน ${futureDays} วัน`,
    )
  }

  if (backdateDays !== -1 && mealDate < addDays(currentDay, -backdateDays)) {
    throw badRequest(
      'MEAL_DATE_TOO_OLD',
      backdateDays === 0
        ? 'บันทึกได้เฉพาะอาหารของวันนี้เท่านั้น'
        : `บันทึกย้อนหลังได้ไม่เกิน ${backdateDays} วัน`,
    )
  }
}

function snapshotOf(item: {
  id: string
  foodId: string
  foodUnitId: string
  foodNameSnapshot: string
  unitNameSnapshot: string
  quantity: Prisma.Decimal
  proteinAmount: Prisma.Decimal
}) {
  return {
    id: item.id,
    foodId: item.foodId,
    foodUnitId: item.foodUnitId,
    foodName: item.foodNameSnapshot,
    unitName: item.unitNameSnapshot,
    quantity: num(item.quantity),
    proteinAmount: num(item.proteinAmount),
  }
}

async function loadFoodUnit(foodUnitId: string) {
  const unit = await prisma.foodUnit.findUnique({
    where: { id: foodUnitId },
    include: { food: true },
  })
  if (!unit) throw notFound('ไม่พบหน่วยอาหารที่เลือก')
  if (unit.food.status !== 'ACTIVE') {
    throw badRequest('FOOD_NOT_ACTIVE', 'อาหารรายการนี้ยังไม่ได้รับการอนุมัติ')
  }
  return unit
}

export type AddMealItemInput = {
  patientId: string
  mealDate: Date
  mealType: MealType
  foodUnitId: string
  quantity: number
  actorId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function addMealItem(input: AddMealItemInput) {
  if (input.quantity <= 0) throw badRequest('INVALID_QUANTITY', 'จำนวนต้องมากกว่า 0')
  await assertMealDateAllowed(input.mealDate)

  const unit = await loadFoodUnit(input.foodUnitId)
  // snapshot ไว้เลย ไม่คำนวณสดจาก Food ทุกครั้ง — แก้ราคาโปรตีนทีหลังต้องไม่กระทบของเก่า
  const proteinAmount = round2(num(unit.proteinAmount) * input.quantity)

  return prisma.$transaction(async (tx) => {
    const meal = await tx.meal.upsert({
      where: {
        patientId_mealDate_mealType: {
          patientId: input.patientId,
          mealDate: input.mealDate,
          mealType: input.mealType,
        },
      },
      create: {
        patientId: input.patientId,
        mealDate: input.mealDate,
        mealType: input.mealType,
      },
      update: {},
    })

    const item = await tx.mealItem.create({
      data: {
        mealId: meal.id,
        foodId: unit.foodId,
        foodUnitId: unit.id,
        foodNameSnapshot: unit.food.name,
        unitNameSnapshot: unit.unitName,
        quantity: toDecimal(input.quantity),
        proteinAmount: toDecimal(proteinAmount),
        createdById: input.actorId,
      },
    })

    await tx.mealItemHistory.create({
      data: {
        mealItemId: item.id,
        mealId: meal.id,
        patientId: input.patientId,
        mealDate: input.mealDate,
        action: 'CREATE',
        oldValue: Prisma.JsonNull,
        newValue: snapshotOf(item) as unknown as Prisma.InputJsonValue,
        changedById: input.actorId,
      },
    })

    await writeAudit(tx, {
      actorId: input.actorId,
      action: 'MEAL_ITEM_CREATE',
      targetType: 'MealItem',
      targetId: item.id,
      newValue: snapshotOf(item) as unknown as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })

    return item
  })
}

export async function updateMealItem(input: {
  mealItemId: string
  quantity: number
  foodUnitId?: string
  actorId: string
  /** ตรวจสิทธิ์มาแล้วจาก route — service เชื่อค่านี้ */
  patientId: string
  ipAddress?: string | null
  userAgent?: string | null
}) {
  if (input.quantity <= 0) throw badRequest('INVALID_QUANTITY', 'จำนวนต้องมากกว่า 0')

  const existing = await prisma.mealItem.findUnique({
    where: { id: input.mealItemId },
    include: { meal: true },
  })
  if (!existing || existing.meal.patientId !== input.patientId) throw notFound('ไม่พบรายการอาหาร')
  await assertMealDateAllowed(existing.meal.mealDate)

  const unit = await loadFoodUnit(input.foodUnitId ?? existing.foodUnitId)
  const proteinAmount = round2(num(unit.proteinAmount) * input.quantity)
  const oldValue = snapshotOf(existing)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.mealItem.update({
      where: { id: existing.id },
      data: {
        foodId: unit.foodId,
        foodUnitId: unit.id,
        foodNameSnapshot: unit.food.name,
        unitNameSnapshot: unit.unitName,
        quantity: toDecimal(input.quantity),
        proteinAmount: toDecimal(proteinAmount),
      },
    })

    await tx.mealItemHistory.create({
      data: {
        mealItemId: updated.id,
        mealId: existing.mealId,
        patientId: input.patientId,
        mealDate: existing.meal.mealDate,
        action: 'UPDATE',
        oldValue: oldValue as unknown as Prisma.InputJsonValue,
        newValue: snapshotOf(updated) as unknown as Prisma.InputJsonValue,
        changedById: input.actorId,
      },
    })

    await writeAudit(tx, {
      actorId: input.actorId,
      action: 'MEAL_ITEM_UPDATE',
      targetType: 'MealItem',
      targetId: updated.id,
      oldValue: oldValue as unknown as Prisma.InputJsonValue,
      newValue: snapshotOf(updated) as unknown as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })

    return updated
  })
}

/** hard delete — MealItemHistory คือแหล่งเดียวที่ reconstruct ข้อมูลเดิมได้ */
export async function deleteMealItem(input: {
  mealItemId: string
  patientId: string
  actorId: string
  ipAddress?: string | null
  userAgent?: string | null
}) {
  const existing = await prisma.mealItem.findUnique({
    where: { id: input.mealItemId },
    include: { meal: true },
  })
  if (!existing || existing.meal.patientId !== input.patientId) throw notFound('ไม่พบรายการอาหาร')
  await assertMealDateAllowed(existing.meal.mealDate)

  const oldValue = snapshotOf(existing)

  await prisma.$transaction(async (tx) => {
    await tx.mealItemHistory.create({
      data: {
        mealItemId: existing.id,
        mealId: existing.mealId,
        patientId: input.patientId,
        mealDate: existing.meal.mealDate,
        action: 'DELETE',
        oldValue: oldValue as unknown as Prisma.InputJsonValue,
        newValue: Prisma.JsonNull,
        changedById: input.actorId,
      },
    })

    await tx.mealItem.delete({ where: { id: existing.id } })

    await writeAudit(tx, {
      actorId: input.actorId,
      action: 'MEAL_ITEM_DELETE',
      targetType: 'MealItem',
      targetId: existing.id,
      oldValue: oldValue as unknown as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  })

  return { id: existing.id, mealDate: formatDateOnly(existing.meal.mealDate) }
}
