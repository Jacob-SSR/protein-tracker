import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { formatDateOnly } from '@/lib/date'
import { num, optionalNum } from '@/lib/decimal'
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui'
import { HealthDataForms } from '@/components/health-data-forms'
import { ProteinTargetPanel } from '@/components/protein-target-panel'
import { ProteinWorkspace } from '@/components/protein/workspace'
import { getWeeklySummary } from '@/lib/meals/summary'
import { getFrequentFoods } from '@/lib/foods/frequent'
import { getCalculationForDate } from '@/lib/protein/calculator'
import { WEIGHT_BASIS_LABELS } from '@/lib/protein/rules'
import { PatientAccountPanel } from '@/components/patient-account-panel'
import { PatientDangerZone } from '@/components/patient-danger-zone'
import { getDailySummary } from '@/lib/meals/summary'
import { isPatientPortalEnabled } from '@/lib/settings'
import { getActiveInvite } from '@/lib/patients/invites'
import { formatDateOnly as toDateString, today } from '@/lib/date'

const GENDER_LABELS = { MALE: 'ชาย', FEMALE: 'หญิง', OTHER: 'อื่นๆ' }

export default async function AdminPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage()
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

  const latestHeight = patient.measurements.find((row) => row.heightCm !== null)
  const patientAgeYears = (() => {
    if (!patient.birthDate) return null
    const now = new Date()
    let age = now.getUTCFullYear() - patient.birthDate.getUTCFullYear()
    const before =
      now.getUTCMonth() < patient.birthDate.getUTCMonth() ||
      (now.getUTCMonth() === patient.birthDate.getUTCMonth() &&
        now.getUTCDate() < patient.birthDate.getUTCDate())
    if (before) age -= 1
    return age >= 0 ? age : null
  })()

  const date = today()
  const activeInvite = patient.userId ? null : await getActiveInvite(patient.id)
  const [summary, weekly, frequentFoods, calculation, counts] = await Promise.all([
    getDailySummary(patient.id, date),
    getWeeklySummary(patient.id, date),
    getFrequentFoods(patient.id),
    getCalculationForDate(patient.id, date),
    prisma.$transaction([
      prisma.patientMeasurement.count({ where: { patientId: patient.id } }),
      prisma.patientLab.count({ where: { patientId: patient.id } }),
      prisma.proteinCalculation.count({ where: { patientId: patient.id } }),
      prisma.mealItem.count({ where: { meal: { patientId: patient.id } } }),
    ]),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={patient.fullName}
        description={`HN ${patient.hn} · ${patient.birthDate ? `เกิด ${formatDateOnly(patient.birthDate)}` : 'ไม่ระบุวันเกิด'}${
          patient.gender ? ` · ${GENDER_LABELS[patient.gender]}` : ''
        }`}
      />

      <ProteinTargetPanel patientId={patient.id} />

      <ProteinWorkspace
        patientId={patient.id}
        initialDate={toDateString(date)}
        initialSummary={summary}
        weekly={weekly}
        frequentFoods={frequentFoods}
        referenceWeightKg={calculation ? num(calculation.referenceWeightKg) : null}
        weightBasisLabel={calculation ? WEIGHT_BASIS_LABELS[calculation.weightBasis] : null}
        weeklyHref={`/admin/patients/${patient.id}`}
      />

      <HealthDataForms
        patientId={patient.id}
        patient={{
          gender: patient.gender,
          ageYears: patientAgeYears,
          heightCm: latestHeight ? num(latestHeight.heightCm) : null,
        }}
        comorbidities={comorbidities}
        selectedCodes={patient.comorbidities.map((row) => row.comorbidity.code)}
      />

      {portalEnabled ? (
        <PatientAccountPanel
          patientId={patient.id}
          hn={patient.hn}
          username={patient.user?.username ?? null}
          activeInvite={activeInvite ? { expiresAt: activeInvite.expiresAt.toISOString() } : null}
        />
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
      <PatientDangerZone
        patientId={patient.id}
        hn={patient.hn}
        fullName={patient.fullName}
        isActive={patient.isActive}
        canDeletePermanently={session.role === 'SUPER_ADMIN'}
        counts={{
          measurements: counts[0],
          labs: counts[1],
          calculations: counts[2],
          mealItems: counts[3],
        }}
      />
    </div>
  )
}
