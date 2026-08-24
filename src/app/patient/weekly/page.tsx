import { requirePatientPage } from '@/lib/auth/guards'
import { today } from '@/lib/date'
import { getWeeklySummary } from '@/lib/meals/summary'
import { Alert, Badge, Card, PageHeader, Table } from '@/components/ui'

export default async function PatientWeeklyPage() {
  const session = await requirePatientPage()
  const summary = await getWeeklySummary(session.patientId, today())

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="สรุปรายสัปดาห์" description={`${summary.from} — ${summary.to}`} />

      <Alert
        tone={
          summary.verdict.level === 'DANGER'
            ? 'danger'
            : summary.verdict.level === 'WARN'
              ? 'warn'
              : 'ok'
        }
      >
        <strong>{summary.verdict.headline}</strong> — {summary.verdict.detail}
      </Alert>

      <Card>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">เฉลี่ยต่อวัน</p>
            <p className="tabular text-xl font-semibold">{summary.averageConsumedGrams} g</p>
          </div>
          <div>
            <p className="text-xs text-muted">วันที่เกินเป้าหมาย</p>
            <p className="tabular text-xl font-semibold">{summary.daysOverTarget} วัน</p>
          </div>
          <div>
            <p className="text-xs text-muted">วันที่ทานน้อยเกินไป</p>
            <p className="tabular text-xl font-semibold">{summary.daysUnderTarget} วัน</p>
          </div>
          <div>
            <p className="text-xs text-muted">วันที่ไม่ได้บันทึก</p>
            <p className="tabular text-xl font-semibold">{summary.daysWithoutRecord} วัน</p>
          </div>
        </div>
      </Card>

      <Card title="รายวัน">
        <Table head={['วันที่', 'เป้าหมาย', 'ทานแล้ว', 'ส่วนต่าง']}>
          {summary.days.map((day) => {
            const diff = day.targetGrams === null ? null : day.consumedGrams - day.targetGrams
            return (
              <tr key={day.date} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{day.date}</td>
                <td className="px-3 py-2 tabular">{day.targetGrams ?? '—'}</td>
                <td className="px-3 py-2 tabular">{day.consumedGrams}</td>
                <td className="px-3 py-2">
                  {diff === null ? (
                    '—'
                  ) : (
                    <Badge tone={diff > 0 ? 'danger' : 'ok'}>
                      {diff > 0 ? '+' : ''}
                      {diff.toFixed(2)} g
                    </Badge>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </div>
  )
}
