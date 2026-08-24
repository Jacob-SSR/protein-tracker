import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { parseDateOnly, today } from '@/lib/date'
import { requestMeta } from '@/lib/audit'
import { resolveTargetPatientId } from '@/lib/patients/access'
import { addMealItem } from '@/lib/meals/service'
import { getDailySummary } from '@/lib/meals/summary'

/** สรุปอาหาร + เป้าหมายของวันนั้น (ใช้เป็น Dashboard รายวัน) */
export async function GET(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const patientId = await resolveTargetPatientId(session, searchParams.get('patientId'))
    const dateParam = searchParams.get('date')
    const date = dateParam ? parseDateOnly(dateParam) : today()

    return ok({ summary: await getDailySummary(patientId, date) })
  })
}

const createSchema = z.object({
  patientId: z.string().optional(),
  mealDate: z.string(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  foodUnitId: z.string().min(1),
  quantity: z.number().positive().max(1000),
})

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const body = createSchema.parse(await request.json())
    const patientId = await resolveTargetPatientId(session, body.patientId ?? null)
    const mealDate = parseDateOnly(body.mealDate)

    const item = await addMealItem({
      patientId,
      mealDate,
      mealType: body.mealType,
      foodUnitId: body.foodUnitId,
      quantity: body.quantity,
      actorId: session.userId,
      ...requestMeta(request),
    })

    // คำนวณยอดรวมของวันนั้นใหม่ทันทีแล้วส่งกลับไปให้ UI
    return ok({ itemId: item.id, summary: await getDailySummary(patientId, mealDate) }, 201)
  })
}
