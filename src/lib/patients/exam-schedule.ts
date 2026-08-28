import { diffDays, formatDateOnly, parseDateOnly, today } from '@/lib/date'

/**
 * รอบการตรวจสุขภาพ — ปกติทุก 3 เดือน ปรับได้ที่ SystemSetting exam_interval_months
 *
 * ใช้บอกเจ้าหน้าที่ว่าผู้ป่วยคนไหนถึงรอบตรวจแล้ว ไม่ได้เป็นการ "ห้าม" บันทึก
 * ผู้ป่วยมาก่อนกำหนดหรือมีเหตุต้องตรวจนอกรอบเกิดขึ้นได้จริง
 * ระบบจึงเตือนแต่ยังเปิดทางให้บันทึกก่อนกำหนดได้เสมอ
 */

export type ExamStatus = 'NO_EXAM' | 'UPCOMING' | 'DUE' | 'OVERDUE'

export type ExamSchedule = {
  intervalMonths: number
  /** วันที่ตรวจครั้งล่าสุด (YYYY-MM-DD) */
  lastExamOn: string | null
  /** วันครบกำหนดตรวจครั้งถัดไป */
  dueOn: string | null
  /** จำนวนวันจนถึงกำหนด ติดลบ = เลยกำหนดมาแล้วกี่วัน */
  daysUntilDue: number | null
  status: ExamStatus
  /** true = ถึงรอบตรวจแล้ว กดบันทึกได้เลยโดยไม่ต้องยืนยันซ้ำ */
  canRecord: boolean
}

/** บวกเดือนแบบไม่ให้วันล้นเดือน เช่น 31 ม.ค. + 1 เดือน = 28/29 ก.พ. ไม่ใช่ 3 มี.ค. */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const lastDayOfTarget = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month + months, Math.min(day, lastDayOfTarget)))
}

export function buildExamSchedule(lastExamOn: string | null, intervalMonths: number): ExamSchedule {
  if (!lastExamOn) {
    return {
      intervalMonths,
      lastExamOn: null,
      dueOn: null,
      daysUntilDue: null,
      status: 'NO_EXAM',
      // ยังไม่เคยตรวจเลย บันทึกได้ทันที ไม่มีอะไรให้รอ
      canRecord: true,
    }
  }

  const due = addMonths(parseDateOnly(lastExamOn), intervalMonths)
  const daysUntilDue = diffDays(today(), due)

  const status: ExamStatus =
    daysUntilDue <= 0 ? (daysUntilDue < -30 ? 'OVERDUE' : 'DUE') : 'UPCOMING'

  return {
    intervalMonths,
    lastExamOn,
    dueOn: formatDateOnly(due),
    daysUntilDue,
    status,
    canRecord: daysUntilDue <= 0,
  }
}
