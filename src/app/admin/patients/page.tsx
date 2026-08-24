import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table } from '@/components/ui'
import { formatDateOnly } from '@/lib/date'
import { num } from '@/lib/decimal'

export default async function AdminPatientsPage() {
  await requireAdminPage()

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      hn: true,
      user: { select: { fullName: true, isActive: true } },
      measurements: { orderBy: { measuredOn: 'desc' }, take: 1 },
      calculations: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ผู้ป่วย"
        description={`${patients.length} ราย`}
        actions={<LinkButton href="/admin/users">+ เพิ่มผู้ป่วย</LinkButton>}
      />

      <Card>
        {patients.length === 0 ? (
          <EmptyState>ยังไม่มีผู้ป่วยในระบบ — เพิ่มได้ที่หน้า &quot;ผู้ใช้&quot;</EmptyState>
        ) : (
          <Table head={['HN', 'ชื่อ-นามสกุล', 'น้ำหนักล่าสุด', 'เป้าหมายโปรตีน', '']}>
            {patients.map((patient) => {
              const target = patient.calculations[0]
              const measurement = patient.measurements[0]
              return (
                <tr key={patient.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{patient.hn}</td>
                  <td className="px-3 py-2">
                    {patient.user.fullName}
                    {patient.user.isActive ? null : (
                      <span className="ml-2">
                        <Badge tone="danger">ปิดใช้งาน</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular">
                    {measurement
                      ? `${num(measurement.weightKg)} kg · ${formatDateOnly(measurement.measuredOn)}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 tabular">
                    {target ? (
                      <Badge tone="brand">{num(target.proteinTargetGrams)} g/วัน</Badge>
                    ) : (
                      <Badge tone="warn">ยังไม่กำหนด</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <LinkButton href={`/admin/patients/${patient.id}`} variant="secondary">
                      จัดการ
                    </LinkButton>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>
    </div>
  )
}
