import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { parseDateOnly, today } from '@/lib/date'
import { resolveTargetPatientId } from '@/lib/patients/access'
import { addGlass, getWaterSummary, undoGlass } from '@/lib/water/service'

/** ยอดน้ำของวันนั้น + เป้าหมาย — ตัวเลขทั้งหมดคิดจาก backend ฝั่ง UI แค่เอาไปโชว์ */
export async function GET(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const patientId = await resolveTargetPatientId(session, searchParams.get('patientId'))
    const dateParam = searchParams.get('date')
    const date = dateParam ? parseDateOnly(dateParam) : today()

    return ok({ water: await getWaterSummary(patientId, date) })
  })
}

const addSchema = z.object({
  patientId: z.string().optional(),
  /** ไม่ส่ง = วันนี้ */
  date: z.string().optional(),
  /** token ต่อการกดหนึ่งครั้ง — ส่งซ้ำจะไม่เกิดแถวใหม่ */
  clientToken: z.string().trim().min(8).max(64).optional(),
})

/** เพิ่มน้ำหนึ่งแก้ว — ขนาดแก้วอ่านจาก SystemSetting ไม่ได้รับมาจาก client */
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const body = addSchema.parse(await request.json().catch(() => ({})))
    const patientId = await resolveTargetPatientId(session, body.patientId ?? null)
    const date = body.date ? parseDateOnly(body.date) : today()

    const water = await addGlass({
      patientId,
      date,
      createdById: session.userId,
      clientToken: body.clientToken,
    })

    return ok({ water }, 201)
  })
}

const undoSchema = z.object({
  patientId: z.string().optional(),
  date: z.string().optional(),
})

/** ถอยกลับหนึ่งแก้ว — ลบเฉพาะรายการล่าสุดของวันนั้น วันอื่นไม่กระทบ */
export async function DELETE(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const body = undoSchema.parse(await request.json().catch(() => ({})))
    const patientId = await resolveTargetPatientId(session, body.patientId ?? null)
    const date = body.date ? parseDateOnly(body.date) : today()

    return ok({ water: await undoGlass({ patientId, date }) })
  })
}
