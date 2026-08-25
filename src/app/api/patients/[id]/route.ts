import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { archivePatient, deletePatientPermanently } from '@/lib/patients/service'
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

const patchSchema = z.object({ isActive: z.boolean() })

/** เก็บเข้าคลัง / กู้คืน */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const { isActive } = patchSchema.parse(await request.json())

    await archivePatient(session, id, isActive, requestMeta(request))
    return ok({ id, isActive })
  })
}

const deleteSchema = z.object({ confirmHn: z.string().min(1) })

/** ลบถาวร — SUPER_ADMIN เท่านั้น และต้องพิมพ์ HN ยืนยัน */
export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(['SUPER_ADMIN'])
    const { id } = await params
    const { confirmHn } = deleteSchema.parse(await request.json())

    const snapshot = await deletePatientPermanently(session, id, confirmHn, requestMeta(request))
    return ok({ deleted: snapshot })
  })
}
