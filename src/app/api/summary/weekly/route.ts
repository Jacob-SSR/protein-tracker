import { handle, ok, requireSession } from '@/lib/api'
import { parseDateOnly, today } from '@/lib/date'
import { resolveTargetPatientId } from '@/lib/patients/access'
import { getWeeklySummary } from '@/lib/meals/summary'

export async function GET(request: Request) {
  return handle(async () => {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const patientId = await resolveTargetPatientId(session, searchParams.get('patientId'))
    const dateParam = searchParams.get('date')
    const date = dateParam ? parseDateOnly(dateParam) : today()

    return ok({ summary: await getWeeklySummary(patientId, date) })
  })
}
