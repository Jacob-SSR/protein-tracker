'use client'

import { useState } from 'react'
import { Alert, Button } from '@/components/ui'
import { ProgressRing } from '@/components/progress-ring'
import { request } from '@/lib/client/api'

export type WaterSummary = {
  date: string
  consumedMl: number
  glassesConsumed: number
  targetMl: number | null
  glassesPerDay: number | null
  percent: number | null
  remainingMl: number | null
  status: 'NO_TARGET' | 'IN_PROGRESS' | 'DONE' | 'OVER'
  glassSizeMl: number
  restricted: boolean
  restrictionReason: string | null
  needsAssessment: boolean
  reminder: { level: 'INFO' | 'WARN'; message: string } | null
}

/** token ต่อการกดหนึ่งครั้ง — ยิงซ้ำด้วย token เดิมจะไม่เกิดแถวใหม่ */
function newToken() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * การ์ดน้ำดื่มของวันนี้ — กดปุ่มเดียวจบ ไม่ต้องกรอกฟอร์ม
 *
 * ตัวเลขทุกตัวมาจาก API ฝั่งนี้ไม่คำนวณเอง กดแล้วอัปเดตจาก response ที่ตอบกลับมา
 * ปุ่มถูกปิดระหว่างรอ request กันกดรัวจนบันทึกเกิน
 */
export function WaterCard({
  initial,
  patientId,
  assessmentHref = '/patient/health',
}: {
  initial: WaterSummary
  /** ตั้งค่าเมื่อเจ้าหน้าที่บันทึกแทนผู้ป่วย */
  patientId?: string
  assessmentHref?: string
}) {
  const [water, setWater] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function mutate(method: 'POST' | 'DELETE') {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const data = await request<{ water: WaterSummary }>('/api/water', {
        method,
        json: {
          patientId,
          date: water.date,
          ...(method === 'POST' ? { clientToken: newToken() } : {}),
        },
      })
      setWater(data.water)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  const glasses = water.glassesConsumed
  const glassTarget = water.glassesPerDay ?? 0
  const percent = water.percent ?? 0
  const done = water.status === 'DONE' || water.status === 'OVER'
  // ยังไม่ได้ประเมิน = ยังไม่มีเป้าหมาย แต่กดนับแก้วได้ตามปกติ
  // ไม่งั้นผู้ป่วยที่เพิ่งสมัครจะกดอะไรไม่ได้เลยทั้งที่ดื่มน้ำอยู่ทุกวัน
  const noTarget = water.needsAssessment

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <span aria-hidden>💧</span> น้ำดื่มวันนี้
          </h2>
          <p className="text-xs text-muted">1 แก้ว = {water.glassSizeMl} มล.</p>
        </div>
        {noTarget ? (
          <a
            href={assessmentHref}
            className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
          >
            ตั้งเป้าหมาย →
          </a>
        ) : done ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              water.status === 'OVER' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'
            }`}
          >
            {water.status === 'OVER' ? 'เกินเป้าหมาย' : 'ครบเป้าหมายแล้ว 🎉'}
          </span>
        ) : null}
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        {noTarget ? (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-8 border-info-soft">
            <span className="text-4xl" aria-hidden>
              💧
            </span>
          </div>
        ) : (
          <ProgressRing
            percent={percent}
            tone={water.status === 'OVER' ? 'warn' : water.status === 'DONE' ? 'ok' : 'info'}
            ariaLabel={`ดื่มน้ำแล้ว ${glasses} จาก ${glassTarget} แก้ว`}
          />
        )}

        <div className="min-w-40 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="tabular text-4xl font-semibold text-info">{glasses}</span>
            <span className="text-lg text-muted">
              {noTarget ? 'แก้ว' : `/ ${glassTarget} แก้ว`}
            </span>
          </p>
          <p className="tabular mt-1 text-sm text-muted">
            {water.consumedMl.toLocaleString('th-TH')}
            {noTarget ? ' มล.' : ` / ${(water.targetMl ?? 0).toLocaleString('th-TH')} มล.`}
          </p>
          <p className="mt-2 text-sm">
            {noTarget ? (
              <span className="text-muted">
                นับแก้วได้เลย — กรอกข้อมูลสุขภาพเมื่อไหร่ ระบบจะบอกว่าควรดื่มวันละกี่แก้ว
              </span>
            ) : water.status === 'OVER' ? (
              <span className="text-warn">
                เกินมา {(water.consumedMl - (water.targetMl ?? 0)).toLocaleString('th-TH')} มล.
              </span>
            ) : water.status === 'DONE' ? (
              <span className="text-ok">ดื่มครบตามเป้าหมายของวันนี้แล้ว</span>
            ) : (
              <span className="text-muted">
                เหลืออีก {(water.remainingMl ?? 0).toLocaleString('th-TH')} มล.
              </span>
            )}
          </p>
        </div>
      </div>

      {water.reminder ? (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn"
          role="status"
        >
          <span aria-hidden>⏰</span>
          <span>{water.reminder.message}</span>
        </p>
      ) : null}

      {water.restricted ? (
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          แพทย์จำกัดน้ำเนื่องจาก{water.restrictionReason} — ดื่มเกินเป้าหมายอาจทำให้บวมมากขึ้น
        </p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void mutate('POST')}
          className="flex-1 rounded-xl bg-info px-4 py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          + 1 แก้ว
        </button>
        <Button
          variant="secondary"
          className="px-4 py-4"
          disabled={pending || glasses === 0}
          onClick={() => void mutate('DELETE')}
          aria-label="ถอยกลับหนึ่งแก้ว"
          title="กดผิด? ถอยกลับหนึ่งแก้ว"
        >
          ↩︎ ถอย 1 แก้ว
        </Button>
      </div>

      {glassTarget > 0 ? <GlassRow filled={glasses} total={glassTarget} /> : null}
    </section>
  )
}

/** แถวแก้วน้ำ — เห็นภาพรวมทั้งวันได้ในแวบเดียว */
function GlassRow({ filled, total }: { filled: number; total: number }) {
  // เป้าหมายเยอะมากก็ไม่ต้องวาดทุกใบ เดี๋ยวรก
  if (total > 16) return null

  return (
    <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`text-xl transition ${index < filled ? '' : 'opacity-25 grayscale'}`}
        >
          🥛
        </span>
      ))}
      {filled > total ? (
        <span className="self-center text-xs text-warn">+{filled - total} แก้ว</span>
      ) : null}
    </div>
  )
}
