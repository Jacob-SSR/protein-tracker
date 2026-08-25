import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { parseDateOnly } from '@/lib/date'
import { toDecimal } from '@/lib/decimal'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'
import { badRequest } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  /** วันที่ของการตรวจครั้งนี้ ใช้ร่วมกันทั้งน้ำหนักและผลเลือด */
  measuredOn: z.string(),
  weightKg: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(300).optional(),
  labs: z
    .array(
      z.object({
        labType: z.string().trim().min(1).max(50),
        value: z.number(),
        unit: z.string().trim().max(20).optional(),
      }),
    )
    .max(20)
    .optional(),
  /** ส่ง null = ไม่แตะโรคร่วม, ส่ง array = แทนที่ทั้งชุด */
  comorbidityCodes: z.array(z.string().trim().min(1)).max(50).nullable().optional(),
})

/**
 * บันทึกข้อมูลสุขภาพทั้งชุดในครั้งเดียว (น้ำหนัก + ผลเลือด + โรคร่วม)
 * หนึ่งครั้งที่เจ้าหน้าที่กดบันทึก = หนึ่งทรานแซคชัน = หนึ่งแถวใน Audit Log
 * ถ้าส่วนใดส่วนหนึ่งพัง จะไม่มีอะไรถูกบันทึกเลย ไม่เหลือข้อมูลค้างครึ่งๆ กลางๆ
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await requirePatientAccess(session, id)

    const body = bodySchema.parse(await request.json())
    const measuredOn = parseDateOnly(body.measuredOn)
    const labs = body.labs?.map((lab) => ({ ...lab, labType: lab.labType.toUpperCase() })) ?? []

    const hasWeight = body.weightKg !== undefined
    const changesComorbidity = body.comorbidityCodes != null
    if (!hasWeight && labs.length === 0 && !changesComorbidity) {
      throw badRequest('NOTHING_TO_SAVE', 'ยังไม่มีข้อมูลให้บันทึก')
    }

    const comorbidities = changesComorbidity
      ? await prisma.comorbidity.findMany({
          where: { code: { in: [...new Set(body.comorbidityCodes!.map((c) => c.toUpperCase()))] } },
        })
      : []
    if (changesComorbidity && comorbidities.length !== new Set(body.comorbidityCodes).size) {
      throw badRequest('UNKNOWN_COMORBIDITY', 'มีรหัสโรคร่วมที่ระบบไม่รู้จัก')
    }

    const saved = await prisma.$transaction(async (tx) => {
      const result = { measurement: false, labs: 0, comorbidities: 0 }

      if (hasWeight) {
        await tx.patientMeasurement.create({
          data: {
            patientId: id,
            measuredOn,
            weightKg: toDecimal(body.weightKg!),
            heightCm: body.heightCm ? toDecimal(body.heightCm) : null,
            recordedById: session.userId,
          },
        })
        result.measurement = true
      }

      for (const lab of labs) {
        await tx.patientLab.create({
          data: {
            patientId: id,
            labType: lab.labType,
            value: toDecimal(lab.value),
            unit: lab.unit || null,
            measuredOn,
            recordedById: session.userId,
          },
        })
      }
      result.labs = labs.length

      if (changesComorbidity) {
        await tx.patientComorbidity.updateMany({ where: { patientId: id }, data: { isActive: false } })
        for (const comorbidity of comorbidities) {
          await tx.patientComorbidity.upsert({
            where: { patientId_comorbidityId: { patientId: id, comorbidityId: comorbidity.id } },
            create: { patientId: id, comorbidityId: comorbidity.id, isActive: true },
            update: { isActive: true },
          })
        }
        result.comorbidities = comorbidities.length
      }

      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PATIENT_HEALTH_DATA_SAVE',
        targetType: 'Patient',
        targetId: id,
        newValue: {
          measuredOn: body.measuredOn,
          weightKg: body.weightKg ?? null,
          heightCm: body.heightCm ?? null,
          labs,
          comorbidityCodes: changesComorbidity ? comorbidities.map((c) => c.code) : null,
        },
        ...requestMeta(request),
      })

      return result
    })

    return ok({ saved }, 201)
  })
}
