import { prisma } from '@/lib/db/prisma'
import { requirePatientPage } from '@/lib/auth/guards'
import { formatDateOnly } from '@/lib/date'
import { num, optionalNum } from '@/lib/decimal'
import { Card, EmptyState, PageHeader, Table } from '@/components/ui'
import { HealthDataForms } from '@/components/health-data-forms'
import { ProteinTargetPanel } from '@/components/protein-target-panel'
import { WaterCard } from '@/components/water/water-card'
import { getWaterSummary } from '@/lib/water/service'
import { today } from '@/lib/date'

/** อายุ ณ วันนี้ — ใช้คำนวณ eGFR ฝั่ง client ระหว่างผู้ป่วยพิมพ์ */
function ageInYears(birthDate: Date | null): number | null {
  if (!birthDate) return null
  const now = new Date()
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

/** หน้าที่ผู้ป่วยบันทึกข้อมูลของตัวเอง — ข้อมูลชุดเดียวกับที่เจ้าหน้าที่กรอกให้ */
export default async function PatientHealthPage() {
  const session = await requirePatientPage()

  const [patient, comorbidities, water] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: session.patientId },
      include: {
        measurements: { orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }], take: 10 },
        comorbidities: { where: { isActive: true }, include: { comorbidity: true } },
      },
    }),
    prisma.comorbidity.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    getWaterSummary(session.patientId, today()),
  ])

  const latestHeight = patient.measurements.find((row) => row.heightCm !== null)
  const latestMeasurement = patient.measurements[0]
  const latestDry = patient.measurements.find((row) => row.dryWeightKg !== null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="บันทึกข้อมูลสุขภาพ"
        description="กรอกน้ำหนัก ภาวะบวม น้ำที่ดื่ม และผลเลือดของตัวเอง แล้วคำนวณเป้าหมายใหม่ได้ทันที"
      />

      <ProteinTargetPanel patientId={patient.id} />

      <WaterCard initial={water} />

      <HealthDataForms
        patientId={patient.id}
        patient={{
          gender: patient.gender,
          ageYears: ageInYears(patient.birthDate),
          heightCm: latestHeight ? num(latestHeight.heightCm) : null,
          weightKg: latestMeasurement ? num(latestMeasurement.weightKg) : null,
          dryWeightKg: latestDry ? num(latestDry.dryWeightKg) : null,
          lastMeasuredOn: latestMeasurement ? formatDateOnly(latestMeasurement.measuredOn) : null,
        }}
        comorbidities={comorbidities}
        selectedCodes={patient.comorbidities.map((row) => row.comorbidity.code)}
        title="บันทึกของวันนี้"
      />

      <Card title="ประวัติที่บันทึกไว้" description="10 ครั้งล่าสุด">
        {patient.measurements.length === 0 ? (
          <EmptyState>ยังไม่มีข้อมูลที่บันทึกไว้</EmptyState>
        ) : (
          <Table
            head={[
              'วันที่',
              'น้ำหนัก (กก.)',
              'ส่วนสูง (ซม.)',
              'Dry weight',
              'ภาวะบวม',
              'ดื่มน้ำ (มล.)',
            ]}
          >
            {patient.measurements.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{formatDateOnly(row.measuredOn)}</td>
                <td className="tabular px-3 py-2">{num(row.weightKg)}</td>
                <td className="tabular px-3 py-2">{optionalNum(row.heightCm) ?? '—'}</td>
                <td className="tabular px-3 py-2">{optionalNum(row.dryWeightKg) ?? '—'}</td>
                <td className="px-3 py-2">
                  {row.hasEdema === null ? '—' : row.hasEdema ? 'บวม' : 'ไม่บวม'}
                </td>
                <td className="tabular px-3 py-2">{row.waterIntakeMl ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
