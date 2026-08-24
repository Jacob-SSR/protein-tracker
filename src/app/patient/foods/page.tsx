import { prisma } from '@/lib/db/prisma'
import { requirePatientPage } from '@/lib/auth/guards'
import { num } from '@/lib/decimal'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { ProposeFoodForm } from '@/components/propose-food-form'

const STATUS_LABEL = {
  PENDING: 'รอแอดมินตรวจสอบ',
  ACTIVE: 'อนุมัติแล้ว ใช้บันทึกได้',
  REJECTED: 'ไม่อนุมัติ',
  ARCHIVED: 'เก็บเข้าคลังแล้ว',
} as const

const STATUS_TONE = {
  PENDING: 'warn',
  ACTIVE: 'ok',
  REJECTED: 'danger',
  ARCHIVED: 'muted',
} as const

export default async function PatientFoodsPage() {
  const session = await requirePatientPage()

  const proposals = await prisma.food.findMany({
    where: { proposedById: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { units: { orderBy: { sortOrder: 'asc' } } },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="เสนออาหารใหม่"
        description="ถ้าค้นหาแล้วไม่เจออาหารที่กิน เสนอเข้ามาได้ แอดมินจะตรวจสอบค่าโปรตีนก่อนเปิดให้ใช้"
      />

      <ProposeFoodForm />

      <Card title="รายการที่คุณเสนอไว้">
        {proposals.length === 0 ? (
          <EmptyState>ยังไม่เคยเสนออาหาร</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {proposals.map((food) => (
              <li key={food.id} className="rounded-lg border border-line p-3">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {food.name}
                  <Badge tone={STATUS_TONE[food.status]}>{STATUS_LABEL[food.status]}</Badge>
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted tabular">
                  {food.units.map((unit) => (
                    <li key={unit.id}>
                      {unit.unitName} → {num(unit.proteinAmount)} g
                    </li>
                  ))}
                </ul>
                {food.rejectReason ? (
                  <p className="mt-1 text-sm text-danger">เหตุผล: {food.rejectReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
