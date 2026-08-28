import { Badge, Card, EmptyState } from '@/components/ui'
import type { Examination, HealthHistory, Trend } from '@/lib/patients/health-history'

/**
 * ประวัติสุขภาพฝั่งผู้ป่วย — ดูอย่างเดียว แก้ไม่ได้
 * ผลตรวจเป็นเอกสารทางการที่เจ้าหน้าที่โภชนาการเป็นคนออก
 */

const LAB_LABELS: Record<string, string> = {
  CREATININE: 'Cr',
  EGFR: 'eGFR',
  BUN: 'BUN',
  ALBUMIN: 'Alb',
  HB: 'Hb',
  HCT: 'HCT',
  FBS: 'FBS',
  TG: 'TG',
  CHOL: 'Chol',
  POTASSIUM: 'K',
  PHOSPHORUS: 'P',
  SODIUM: 'Na',
}

const labLabel = (code: string) => LAB_LABELS[code] ?? code

function thaiDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * ลูกศรบอกทิศ พร้อมคำอธิบายว่าดีขึ้นหรือแย่ลง
 * น้ำหนัก/BMI ขึ้นหรือลง "ดี" ไม่เท่ากันในแต่ละคน จึงบอกแค่ทิศกับตัวเลข
 * ไม่ตัดสินว่าดีหรือแย่ — ให้เจ้าหน้าที่เป็นคนบอก
 */
export function TrendBadge({ trend, unit }: { trend: Trend; unit: string }) {
  if (trend.direction === 'UNKNOWN' || trend.delta === null) return null
  if (trend.direction === 'SAME') {
    return <span className="text-xs text-muted">เท่าเดิม</span>
  }

  const up = trend.direction === 'UP'
  return (
    <span className={`text-xs ${up ? 'text-warn' : 'text-info'}`}>
      {up ? '▲' : '▼'} {Math.abs(trend.delta)} {unit} จากครั้งก่อน
    </span>
  )
}

export function HealthHistoryView({ history }: { history: HealthHistory }) {
  const { examinations, latest, labTypes, trends } = history

  if (!latest) {
    return (
      <Card title="ผลตรวจสุขภาพ">
        <EmptyState>
          ยังไม่มีผลตรวจ — เจ้าหน้าที่โภชนาการจะเป็นผู้บันทึกให้เมื่อคุณเข้ารับการตรวจ
        </EmptyState>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="ผลตรวจล่าสุด"
        description={`ตรวจเมื่อ ${thaiDate(latest.date)}${latest.recordedBy ? ` · บันทึกโดย ${latest.recordedBy}` : ''}`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="น้ำหนัก"
            value={latest.weightKg}
            unit="กก."
            trend={trends.weight}
            trendUnit="กก."
          />
          <Metric label="ส่วนสูง" value={latest.heightCm} unit="ซม." />
          <Metric
            label="BMI"
            value={latest.bmi}
            unit=""
            note={latest.bmiLabel}
            trend={trends.bmi}
            trendUnit=""
          />
          <Metric label="น้ำหนักแห้ง" value={latest.dryWeightKg} unit="กก." />
        </div>

        {latest.hasEdema !== null ? (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted">ภาวะบวม</span>
            <Badge tone={latest.hasEdema ? 'warn' : 'ok'}>
              {latest.hasEdema ? 'บวม' : 'ไม่บวม'}
            </Badge>
          </p>
        ) : null}

        {latest.labs.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {latest.labs.map((lab) => (
              <li key={lab.labType} className="rounded-full border border-line px-3 py-1.5 text-sm">
                <span className="text-muted">{labLabel(lab.labType)}</span>{' '}
                <span className="tabular font-medium">{lab.value}</span>{' '}
                <span className="text-xs text-muted">{lab.unit ?? ''}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card
        title="ประวัติการตรวจ"
        description="ปกติตรวจทุก 3 เดือน ผลเก่าไม่ถูกลบ เทียบย้อนหลังได้"
      >
        {examinations.length === 1 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            มีผลตรวจครั้งเดียว — ครั้งหน้าจะเทียบให้เห็นว่าเปลี่ยนไปยังไง
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-3 py-2 font-medium">วันที่ตรวจ</th>
                  <th className="px-3 py-2 font-medium">น้ำหนัก</th>
                  <th className="px-3 py-2 font-medium">ส่วนสูง</th>
                  <th className="px-3 py-2 font-medium">BMI</th>
                  {labTypes.map((code) => (
                    <th key={code} className="px-3 py-2 font-medium whitespace-nowrap">
                      {labLabel(code)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examinations.map((row, index) => (
                  <ExaminationRow
                    key={row.date}
                    examination={row}
                    labTypes={labTypes}
                    isLatest={index === 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function ExaminationRow({
  examination,
  labTypes,
  isLatest,
}: {
  examination: Examination
  labTypes: string[]
  isLatest: boolean
}) {
  const labValue = (code: string) => examination.labs.find((lab) => lab.labType === code)?.value

  return (
    <tr className={`border-b border-line last:border-0 ${isLatest ? 'bg-brand-tint' : ''}`}>
      <td className="px-3 py-2 whitespace-nowrap">
        {thaiDate(examination.date)}
        {isLatest ? <span className="ml-2 text-xs text-brand">ล่าสุด</span> : null}
      </td>
      <td className="tabular px-3 py-2">{examination.weightKg ?? '—'}</td>
      <td className="tabular px-3 py-2">{examination.heightCm ?? '—'}</td>
      <td className="tabular px-3 py-2">{examination.bmi ?? '—'}</td>
      {labTypes.map((code) => (
        <td key={code} className="tabular px-3 py-2">
          {labValue(code) ?? '—'}
        </td>
      ))}
    </tr>
  )
}

function Metric({
  label,
  value,
  unit,
  note,
  trend,
  trendUnit,
}: {
  label: string
  value: number | null
  unit: string
  note?: string | null
  trend?: Trend
  trendUnit?: string
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-semibold">
        {value ?? '—'}
        {value !== null && unit ? <span className="ml-1 text-sm font-normal">{unit}</span> : null}
      </p>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      {trend ? <TrendBadge trend={trend} unit={trendUnit ?? unit} /> : null}
    </div>
  )
}
