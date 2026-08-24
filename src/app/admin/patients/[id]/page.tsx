import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { formatDateOnly } from '@/lib/date'
import { num, optionalNum } from '@/lib/decimal'
import { ProteinTargetPanel } from '@/components/protein-target-panel'
import { requireAdminPage } from '@/lib/auth/guards'

export default async function AdminPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      user: { select: { fullName: true } },
      measurements: { orderBy: { measuredOn: 'desc' }, take: 5 },
      labs: { orderBy: { measuredOn: 'desc' }, take: 10 },
      comorbidities: { where: { isActive: true }, include: { comorbidity: true } },
      calculations: { orderBy: { effectiveFrom: 'desc' }, take: 10 },
    },
  })

  if (!patient) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{patient.user.fullName}</h1>
        <p className="text-sm text-gray-500">HN {patient.hn}</p>
      </div>

      <section className="rounded border p-3 text-sm">
        <h2 className="font-medium">ข้อมูลสุขภาพล่าสุด</h2>
        <p className="mt-1">
          น้ำหนัก:{' '}
          {patient.measurements[0]
            ? `${num(patient.measurements[0].weightKg)} kg (${formatDateOnly(patient.measurements[0].measuredOn)})`
            : 'ยังไม่มีข้อมูล'}
          {patient.measurements[0]?.heightCm
            ? ` · สูง ${optionalNum(patient.measurements[0].heightCm)} cm`
            : ''}
        </p>
        <p className="mt-1">
          โรคร่วม:{' '}
          {patient.comorbidities.length === 0
            ? 'ไม่มี'
            : patient.comorbidities.map((row) => row.comorbidity.name).join(', ')}
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-gray-600">
          {patient.labs.map((lab) => (
            <li key={lab.id}>
              {lab.labType}: {num(lab.value)} {lab.unit ?? ''} ({formatDateOnly(lab.measuredOn)})
            </li>
          ))}
        </ul>
      </section>

      <ProteinTargetPanel patientId={patient.id} />

      <section className="rounded border p-3 text-sm">
        <h2 className="font-medium">ประวัติเป้าหมายโปรตีน</h2>
        <ul className="mt-2 flex flex-col gap-1 text-gray-600">
          {patient.calculations.map((row) => (
            <li key={row.id}>
              {formatDateOnly(row.effectiveFrom)} —{' '}
              {row.effectiveTo ? formatDateOnly(row.effectiveTo) : 'ปัจจุบัน'}:{' '}
              {num(row.proteinTargetGrams)} g ({num(row.proteinFactor)} g/kg ·{' '}
              {row.ruleNameSnapshot ?? 'ไม่ระบุกฎ'})
            </li>
          ))}
          {patient.calculations.length === 0 ? <li>ยังไม่เคยกำหนดเป้าหมาย</li> : null}
        </ul>
      </section>
    </div>
  )
}
