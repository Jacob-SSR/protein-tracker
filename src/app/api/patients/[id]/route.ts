import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requirePatientAccess } from '@/lib/patients/access'
import { getActiveCalculation } from '@/lib/protein/calculator'
import { formatDateOnly } from '@/lib/date'
import { num, optionalNum } from '@/lib/decimal'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession()
    const { id } = await params
    await requirePatientAccess(session, id)

    const [patient, active] = await Promise.all([
      prisma.patient.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          hn: true,
          birthDate: true,
          gender: true,
          fullName: true,
          user: { select: { username: true } },
          measurements: { orderBy: { measuredOn: 'desc' }, take: 10 },
          labs: { orderBy: { measuredOn: 'desc' }, take: 30 },
          comorbidities: {
            where: { isActive: true },
            include: { comorbidity: true },
          },
        },
      }),
      getActiveCalculation(id),
    ])

    return ok({
      patient: {
        id: patient.id,
        hn: patient.hn,
        fullName: patient.fullName,
        birthDate: patient.birthDate ? formatDateOnly(patient.birthDate) : null,
        gender: patient.gender,
        measurements: patient.measurements.map((row) => ({
          id: row.id,
          measuredOn: formatDateOnly(row.measuredOn),
          weightKg: num(row.weightKg),
          heightCm: optionalNum(row.heightCm),
        })),
        labs: patient.labs.map((row) => ({
          id: row.id,
          labType: row.labType,
          value: num(row.value),
          unit: row.unit,
          measuredOn: formatDateOnly(row.measuredOn),
        })),
        comorbidities: patient.comorbidities.map((row) => ({
          code: row.comorbidity.code,
          name: row.comorbidity.name,
        })),
      },
      proteinTarget: active
        ? {
            id: active.id,
            proteinTargetGrams: num(active.proteinTargetGrams),
            proteinFactor: num(active.proteinFactor),
            referenceWeightKg: num(active.referenceWeightKg),
            effectiveFrom: formatDateOnly(active.effectiveFrom),
            ruleName: active.ruleNameSnapshot,
          }
        : null,
    })
  })
}
