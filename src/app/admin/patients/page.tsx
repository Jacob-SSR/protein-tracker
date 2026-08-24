import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table } from '@/components/ui'
import { formatDateOnly } from '@/lib/date'
import { num } from '@/lib/decimal'
import { isPatientPortalEnabled } from '@/lib/settings'
import { PatientCreateForm } from '@/components/patient-create-form'

export default async function AdminPatientsPage() {
  await requireAdminPage()

  const [patients, portalEnabled] = await Promise.all([
    prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        hn: true,
        fullName: true,
        userId: true,
        measurements: { orderBy: { measuredOn: 'desc' }, take: 1 },
        calculations: { where: { effectiveTo: null }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    }),
    isPatientPortalEnabled(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ผู้ป่วย"
        description={`${patients.length} ราย · เจ้าหน้าที่เป็นผู้บันทึกข้อมูลให้ ผู้ป่วยไม่ต้องมีบัญชี`}
      />

      <PatientCreateForm />

      <Card>
        {patients.length === 0 ? (
          <EmptyState>ยังไม่มีผู้ป่วยในระบบ — กด &quot;เพิ่มผู้ป่วย&quot; ด้านบน</EmptyState>
        ) : (
          <Table
            head={[
              'HN',
              'ชื่อ-นามสกุล',
              'น้ำหนักล่าสุด',
              'เป้าหมายโปรตีน',
              ...(portalEnabled ? ['บัญชีผู้ป่วย'] : []),
              '',
            ]}
          >
            {patients.map((patient) => {
              const target = patient.calculations[0]
              const measurement = patient.measurements[0]
              return (
                <tr key={patient.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{patient.hn}</td>
                  <td className="px-3 py-2">{patient.fullName}</td>
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
                  {portalEnabled ? (
                    <td className="px-3 py-2">
                      <Badge tone={patient.userId ? 'ok' : 'muted'}>
                        {patient.userId ? 'เข้าระบบเองได้' : 'ยังไม่เปิดสิทธิ์'}
                      </Badge>
                    </td>
                  ) : null}
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
