import { prisma } from '@/lib/db/prisma'
import { formatDateOnly } from '@/lib/date'
import { num, optionalNum } from '@/lib/decimal'
import { bmiCategory, bmiOf } from '@/lib/protein/body-metrics'

/**
 * ประวัติการตรวจสุขภาพ — จัดกลุ่มตาม "วันที่ตรวจ"
 *
 * น้ำหนักกับผลเลือดเก็บคนละตาราง แต่บันทึกด้วย measuredOn เดียวกันในการตรวจครั้งเดียว
 * ที่นี่จึงรวมกลับมาเป็นครั้งการตรวจ (examination) ให้ UI ใช้ได้ตรงๆ
 *
 * ทุกครั้งเป็นแถวใหม่เสมอ ไม่เคยทับของเก่า — เทียบย้อนหลังได้ครบ
 */

export type LabResult = { labType: string; value: number; unit: string | null }

export type Examination = {
  date: string
  weightKg: number | null
  heightCm: number | null
  dryWeightKg: number | null
  hasEdema: boolean | null
  bmi: number | null
  bmiLabel: string | null
  labs: LabResult[]
  recordedBy: string | null
}

export type TrendDirection = 'UP' | 'DOWN' | 'SAME' | 'UNKNOWN'

export type Trend = {
  direction: TrendDirection
  /** ต่างจากครั้งก่อนเท่าไร (บวก = เพิ่มขึ้น) */
  delta: number | null
}

function trendOf(current: number | null, previous: number | null): Trend {
  if (current === null || previous === null) return { direction: 'UNKNOWN', delta: null }
  const delta = Math.round((current - previous) * 10) / 10
  if (delta === 0) return { direction: 'SAME', delta: 0 }
  return { direction: delta > 0 ? 'UP' : 'DOWN', delta }
}

export type HealthHistory = {
  examinations: Examination[]
  latest: Examination | null
  previous: Examination | null
  trends: { weight: Trend; bmi: Trend }
  /** ผลเลือดที่มีอย่างน้อยหนึ่งครั้ง ใช้เป็นหัวคอลัมน์ตารางเทียบ */
  labTypes: string[]
}

export async function getHealthHistory(patientId: string, take = 20): Promise<HealthHistory> {
  const [measurements, labs] = await Promise.all([
    prisma.patientMeasurement.findMany({
      where: { patientId },
      orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
      take,
      include: { recordedBy: { select: { fullName: true } } },
    }),
    prisma.patientLab.findMany({
      where: { patientId },
      orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
      take: take * 15,
    }),
  ])

  // ส่วนสูงมักวัดครั้งเดียวแล้วไม่วัดซ้ำ ครั้งที่ไม่ได้วัดให้ใช้ค่าล่าสุดที่เคยมี
  const fallbackHeight = measurements.find((row) => row.heightCm !== null)?.heightCm ?? null

  const byDate = new Map<string, Examination>()

  for (const row of measurements) {
    const date = formatDateOnly(row.measuredOn)
    if (byDate.has(date)) continue // วันเดียวกันชั่งซ้ำ เอาแถวล่าสุดพอ

    const weightKg = num(row.weightKg)
    const heightCm = optionalNum(row.heightCm) ?? optionalNum(fallbackHeight)
    const bmi = bmiOf(weightKg, heightCm)

    byDate.set(date, {
      date,
      weightKg,
      heightCm,
      dryWeightKg: optionalNum(row.dryWeightKg),
      hasEdema: row.hasEdema,
      bmi,
      bmiLabel: bmiCategory(bmi),
      labs: [],
      recordedBy: row.recordedBy.fullName,
    })
  }

  for (const lab of labs) {
    const date = formatDateOnly(lab.measuredOn)
    // ผลเลือดที่ไม่มีการชั่งน้ำหนักในวันนั้น ก็ยังเป็นการตรวจครั้งหนึ่ง
    const examination =
      byDate.get(date) ??
      ({
        date,
        weightKg: null,
        heightCm: null,
        dryWeightKg: null,
        hasEdema: null,
        bmi: null,
        bmiLabel: null,
        labs: [],
        recordedBy: null,
      } satisfies Examination)

    if (!examination.labs.some((row) => row.labType === lab.labType)) {
      examination.labs.push({
        labType: lab.labType,
        value: num(lab.value),
        unit: lab.unit,
      })
    }
    byDate.set(date, examination)
  }

  const examinations = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
  const [latest = null, previous = null] = examinations

  const labTypes = [
    ...new Set(examinations.flatMap((row) => row.labs.map((lab) => lab.labType))),
  ].sort()

  return {
    examinations,
    latest,
    previous,
    trends: {
      weight: trendOf(latest?.weightKg ?? null, previous?.weightKg ?? null),
      bmi: trendOf(latest?.bmi ?? null, previous?.bmi ?? null),
    },
    labTypes,
  }
}
