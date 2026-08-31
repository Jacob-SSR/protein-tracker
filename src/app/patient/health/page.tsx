import { requirePatientPage } from '@/lib/auth/guards'
import { today } from '@/lib/date'
import { num } from '@/lib/decimal'
import { Alert, Card, PageHeader } from '@/components/ui'
import { HealthHistoryView } from '@/components/patient/health-history-view'
import { WaterCard } from '@/components/water/water-card'
import { getHealthHistory } from '@/lib/patients/health-history'
import { getCalculationForDate } from '@/lib/protein/calculator'
import { WEIGHT_BASIS_LABELS } from '@/lib/protein/rules'
import { getWaterSummary } from '@/lib/water/service'
import { toSpoonDisplay } from '@/lib/protein/spoons'

/**
 * หน้าสุขภาพของผู้ป่วย — ดูอย่างเดียว
 * ผลตรวจเป็นเอกสารทางการที่เจ้าหน้าที่โภชนาการเป็นคนออก ผู้ป่วยแก้เองไม่ได้
 * สิ่งที่ผู้ป่วยบันทึกเองได้คือกิจวัตรประจำวัน (น้ำดื่ม อาหาร) ซึ่งอยู่คนละส่วนกัน
 */
export default async function PatientHealthPage() {
  const session = await requirePatientPage()
  const date = today()

  const [history, calculation, water] = await Promise.all([
    getHealthHistory(session.patientId),
    getCalculationForDate(session.patientId, date),
    getWaterSummary(session.patientId, date),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="สุขภาพของฉัน"
        description="ผลตรวจและเป้าหมายที่เจ้าหน้าที่โภชนาการกำหนดให้"
      />

      <Alert tone="muted">
        ผลตรวจในหน้านี้บันทึกโดยเจ้าหน้าที่โภชนาการเท่านั้น
        ถ้าเห็นว่าข้อมูลไม่ถูกต้องกรุณาแจ้งเจ้าหน้าที่ ส่วนน้ำดื่มและอาหารประจำวัน
        คุณบันทึกเองได้ที่หน้าหลัก
      </Alert>

      {calculation ? (
        <Card title="เป้าหมายประจำวัน" description="คำนวณจากผลตรวจล่าสุด">
          <div className="grid gap-3 sm:grid-cols-3">
            <Target
              label="โปรตีน"
              value={`🥄 ประมาณ ${proteinSpoonLabel(
                calculation.proteinTargetGramsMin === null
                  ? null
                  : num(calculation.proteinTargetGramsMin),
                num(calculation.proteinTargetGrams),
              )} ช้อน`}
              note={`${
                calculation.proteinTargetGramsMin === null
                  ? num(calculation.proteinTargetGrams)
                  : `${num(calculation.proteinTargetGramsMin)}–${num(calculation.proteinTargetGrams)}`
              } กรัม/วัน · ปัดเป็นปริมาณที่ตวงได้ง่าย`}
            />
            <Target
              label="พลังงาน"
              value={
                calculation.energyTargetKcal
                  ? `${num(calculation.energyTargetKcal).toLocaleString('th-TH')} kcal`
                  : '—'
              }
              note={
                calculation.energyFactorKcal
                  ? `${calculation.energyFactorKcal} kcal ต่อน้ำหนักตัว 1 กก.`
                  : 'ยังไม่ได้กำหนด'
              }
            />
            <Target
              label="น้ำดื่ม"
              value={water.targetMl ? `${water.targetMl.toLocaleString('th-TH')} มล.` : '—'}
              note={water.glassesPerDay ? `${water.glassesPerDay} แก้วต่อวัน` : 'ยังไม่ได้กำหนด'}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            คำนวณจาก{WEIGHT_BASIS_LABELS[calculation.weightBasis]}{' '}
            {num(calculation.referenceWeightKg)} กก.
            {calculation.ckdStageCode ? ` · โรคไต ${calculation.ckdStageCode}` : ''}
          </p>
        </Card>
      ) : null}

      <HealthHistoryView history={history} />

      <WaterCard initial={water} />
    </div>
  )
}

function Target({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-brand-tint p-4">
      <p className="text-xs text-brand">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-semibold text-brand">{value}</p>
      <p className="tabular mt-0.5 text-xs text-muted">{note}</p>
    </div>
  )
}

/** แนวทางให้โปรตีนมาเป็นช่วง — ปัดทั้งสองขอบแล้วค่อยรวมเป็นข้อความเดียว */
function proteinSpoonLabel(minGrams: number | null, maxGrams: number) {
  const max = toSpoonDisplay(maxGrams)
  if (minGrams === null) return max.text
  const min = toSpoonDisplay(minGrams)
  return min.text === max.text ? max.text : `${min.text}–${max.text}`
}
