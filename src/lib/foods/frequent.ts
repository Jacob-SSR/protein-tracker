import { prisma } from '@/lib/db/prisma'
import { num } from '@/lib/decimal'

export type FrequentFood = {
  unitId: string
  foodName: string
  unitName: string
  proteinAmount: number
}

/**
 * อาหารที่ผู้ป่วยรายนี้บันทึกบ่อยที่สุด ใช้ทำปุ่มลัด
 * ยังไม่มีประวัติ (ผู้ป่วยใหม่) ให้ตกไปใช้อาหารหลักในฐานข้อมูลแทน จะได้ไม่เห็นช่องว่างเปล่า
 */
export async function getFrequentFoods(patientId: string, take = 4): Promise<FrequentFood[]> {
  const grouped = await prisma.mealItem.groupBy({
    by: ['foodUnitId'],
    where: { meal: { patientId } },
    _count: { foodUnitId: true },
    orderBy: { _count: { foodUnitId: 'desc' } },
    take,
  })

  const ids = grouped.map((row) => row.foodUnitId)

  const units = await prisma.foodUnit.findMany({
    where:
      ids.length > 0
        ? { id: { in: ids }, food: { status: 'ACTIVE' } }
        : { isDefault: true, food: { status: 'ACTIVE' } },
    include: { food: { select: { name: true } } },
    take,
    orderBy: ids.length > 0 ? undefined : { food: { name: 'asc' } },
  })

  const byUsage = new Map(ids.map((id, index) => [id, index]))

  return units
    .sort((a, b) => (byUsage.get(a.id) ?? 0) - (byUsage.get(b.id) ?? 0))
    .map((unit) => ({
      unitId: unit.id,
      foodName: unit.food.name,
      unitName: unit.unitName,
      proteinAmount: num(unit.proteinAmount),
    }))
}
