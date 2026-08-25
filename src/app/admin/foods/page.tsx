import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { num } from '@/lib/decimal'
import { PageHeader } from '@/components/ui'
import { FoodManager } from '@/components/food-manager'

export default async function AdminFoodsPage() {
  await requireAdminPage()

  const foods = await prisma.food.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 500,
    include: {
      units: { orderBy: { sortOrder: 'asc' } },
      proposedBy: { select: { fullName: true } },
      _count: { select: { mealItems: true } },
    },
  })

  const pendingCount = foods.filter((food) => food.status === 'PENDING').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ฐานข้อมูลอาหาร"
        description={
          pendingCount > 0
            ? `มี ${pendingCount} รายการที่ผู้ป่วยเสนอเข้ามารออนุมัติ`
            : 'ไม่มีรายการรออนุมัติ'
        }
      />
      <FoodManager
        foods={foods.map((food) => ({
          id: food.id,
          name: food.name,
          category: food.category,
          description: food.description,
          status: food.status,
          rejectReason: food.rejectReason,
          proposedBy: food.proposedBy?.fullName ?? null,
          usageCount: food._count.mealItems,
          units: food.units.map((unit) => ({
            id: unit.id,
            unitName: unit.unitName,
            gramsPerUnit: unit.gramsPerUnit ? num(unit.gramsPerUnit) : null,
            proteinAmount: num(unit.proteinAmount),
            isDefault: unit.isDefault,
          })),
        }))}
      />
    </div>
  )
}
