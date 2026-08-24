import { prisma } from '@/lib/db/prisma'
import { num } from '@/lib/decimal'
import { FoodApprovalList } from '@/components/food-approval-list'
import { requireAdminPage } from '@/lib/auth/guards'

export default async function AdminFoodsPage() {
  await requireAdminPage()

  const foods = await prisma.food.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      units: { orderBy: { sortOrder: 'asc' } },
      proposedBy: { select: { fullName: true } },
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">อาหารที่รออนุมัติ</h1>
      <FoodApprovalList
        foods={foods.map((food) => ({
          id: food.id,
          name: food.name,
          category: food.category,
          proposedBy: food.proposedBy?.fullName ?? 'ไม่ทราบ',
          units: food.units.map((unit) => ({
            id: unit.id,
            unitName: unit.unitName,
            proteinAmount: num(unit.proteinAmount),
          })),
        }))}
      />
    </div>
  )
}
