import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { formatDateOnly } from '@/lib/date'
import { num, optionalNum } from '@/lib/decimal'
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui'
import { HealthDataForms } from '@/components/health-data-forms'
import { ProteinTargetPanel } from '@/components/protein-target-panel'
import { MealLogger } from '@/components/meal-logger'
import { PatientAccountPanel } from '@/components/patient-account-panel'
import { getDailySummary } from '@/lib/meals/summary'
import { isPatientPortalEnabled } from '@/lib/settings'
import { formatDateOnly as toDateString, today } from '@/lib/date'

const GENDER_LABELS = { MALE: 'ชาย', FEMALE: 'หญิง', OTHER: 'อื่นๆ' }

export default async function AdminPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params

  const [patient, comorbidities, portalEnabled] = await Promise.all([
    prisma.patient.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
        measurements: { orderBy: { measuredOn: 'desc' }, take: 10 },
        labs: {
          orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
          take: 30,
        },
        comorbidities: {
          where: { isActive: true },
          include: { comorbidity: true },
        },
        calculations: { orderBy: { effectiveFrom: 'desc' }, take: 10 },
      },
    }),
    prisma.comorbidity.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    }),
    isPatientPortalEnabled(),
  ])

  if (!patient) notFound()

  const date = today()
  const summary = await getDailySummary(patient.id, date)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={patient.fullName}
        description={`HN ${patient.hn} · ${patient.birthDate ? `เกิด ${formatDateOnly(patient.birthDate)}` : 'ไม่ระบุวันเกิด'}${
          patient.gender ? ` · ${GENDER_LABELS[patient.gender]}` : ''
        }`}
      />

      <ProteinTargetPanel patientId={patient.id} />

      <div>
        <h2 className="mb-2 font-medium">บันทึกอาหารให้ผู้ป่วย</h2>
        <MealLogger
          patientId={patient.id}
          initialDate={toDateString(date)}
          initialSummary={summary}
        />
      </div>

      <HealthDataForms
        patientId={patient.id}
        comorbidities={comorbidities}
        selectedCodes={patient.comorbidities.map((row) => row.comorbidity.code)}
      />

      {portalEnabled ? (
        <PatientAccountPanel patientId={patient.id} username={patient.user?.username ?? null} />
      ) : null}

      <Card title="ประวัติน้ำหนัก / ส่วนสูง">
        {patient.measurements.length === 0 ? (
          <EmptyState>ยังไม่มีข้อมูล</EmptyState>
        ) : (
          <Table head={['วันที่วัด', 'น้ำหนัก (kg)', 'ส่วนสูง (cm)']}>
            {patient.measurements.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{formatDateOnly(row.measuredOn)}</td>
                <td className="px-3 py-2 tabular">{num(row.weightKg)}</td>
                <td className="px-3 py-2 tabular">{optionalNum(row.heightCm) ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ผลเลือด">
        {patient.labs.length === 0 ? (
          <EmptyState>ยังไม่มีข้อมูล</EmptyState>
        ) : (
          <Table head={['รายการ', 'ค่า', 'หน่วย', 'วันที่ตรวจ']}>
            {patient.labs.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{row.labType}</td>
                <td className="px-3 py-2 tabular">{num(row.value)}</td>
                <td className="px-3 py-2 text-muted">{row.unit ?? '—'}</td>
                <td className="px-3 py-2">{formatDateOnly(row.measuredOn)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card
        title="ประวัติเป้าหมายโปรตีน"
        description="ทุกครั้งที่ยืนยันเป้าหมายใหม่ ระบบปิดแถวเดิมแล้วสร้างแถวใหม่ ไม่ทับของเก่า"
      >
        {patient.calculations.length === 0 ? (
          <EmptyState>ยังไม่เคยกำหนดเป้าหมาย</EmptyState>
        ) : (
          <Table head={['ช่วงที่มีผล', 'เป้าหมาย', 'สูตร', 'กฎที่ใช้']}>
            {patient.calculations.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  {formatDateOnly(row.effectiveFrom)} →{' '}
                  {row.effectiveTo ? (
                    formatDateOnly(row.effectiveTo)
                  ) : (
                    <Badge tone="ok">ปัจจุบัน</Badge>
                  )}
                </td>
                <td className="px-3 py-2 tabular font-medium">{num(row.proteinTargetGrams)} g</td>
                <td className="px-3 py-2 tabular text-muted">
                  {num(row.proteinFactor)} × {num(row.referenceWeightKg)} kg
                </td>
                <td className="px-3 py-2 text-muted">
                  {row.ruleNameSnapshot ?? '—'}
                  {row.ruleVersion ? ` (v${row.ruleVersion})` : ''}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
