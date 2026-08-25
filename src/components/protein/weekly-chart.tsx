'use client'

import { useState } from 'react'

type Day = { date: string; targetGrams: number | null; consumedGrams: number }

const WEEKDAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
const PLOT_HEIGHT = 120

/**
 * แท่งรายวันเทียบเป้าหมาย 7 วัน
 * ซีรีส์เดียว แยกสีเฉพาะ "ส่วนที่เกินเป้าหมาย" ซึ่งเป็นสถานะ ไม่ใช่ซีรีส์ที่สอง
 * มีตัวเลขกำกับทุกแท่งแทนแกน Y — ตัวเลขนี้ทำหน้าที่ชดเชยคอนทราสต์ของสีส้มด้วย
 */
export function WeeklyChart({ days, targetGrams }: { days: Day[]; targetGrams: number | null }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const maxValue = Math.max(...days.map((day) => day.consumedGrams), targetGrams ?? 0, 1)
  const ceiling = maxValue * 1.18
  const px = (grams: number) => (grams / ceiling) * PLOT_HEIGHT

  return (
    <div className="flex flex-col gap-1">
      {targetGrams ? (
        <p className="text-[11px] text-muted">
          <span className="mr-1 inline-block h-px w-4 border-t border-dashed border-danger align-middle" />
          เป้าหมาย {targetGrams} g/วัน
        </p>
      ) : null}

      <div className="relative" style={{ height: PLOT_HEIGHT + 18 }}>
        {targetGrams ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-danger/70"
            style={{ bottom: px(targetGrams) }}
          />
        ) : null}

        <div
          className="absolute inset-x-0 bottom-0 flex items-end gap-1.5"
          style={{ height: PLOT_HEIGHT }}
        >
          {days.map((day, index) => {
            const cap = targetGrams ?? day.consumedGrams
            const within = Math.min(day.consumedGrams, cap)
            const over = Math.max(day.consumedGrams - cap, 0)
            return (
              <div
                key={day.date}
                className="relative flex flex-1 flex-col justify-end"
                style={{ height: PLOT_HEIGHT }}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              >
                {hovered === index ? (
                  <div className="absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-lg bg-foreground px-2 py-1 text-[11px] text-white shadow">
                    {day.date} · {day.consumedGrams} g
                    {day.targetGrams ? ` / ${day.targetGrams} g` : ''}
                  </div>
                ) : null}

                {day.consumedGrams > 0 ? (
                  <span
                    className="absolute inset-x-0 text-center text-[10px] tabular text-muted"
                    style={{ bottom: px(day.consumedGrams) + 3 }}
                  >
                    {Math.round(day.consumedGrams)}
                  </span>
                ) : null}

                {over > 0 ? (
                  <div
                    className="rounded-t-[4px]"
                    style={{ height: px(over), background: 'var(--chart-over)' }}
                  />
                ) : null}
                <div
                  style={{
                    height: px(within),
                    background: 'var(--chart-in)',
                    marginTop: over > 0 ? 2 : 0,
                    borderTopLeftRadius: over > 0 ? 0 : 4,
                    borderTopRightRadius: over > 0 ? 0 : 4,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-1.5">
        {days.map((day, index) => (
          <span key={day.date} className="flex-1 text-center text-[11px] text-muted">
            {WEEKDAYS[index]}
          </span>
        ))}
      </div>

      <div className="mt-1 flex justify-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--chart-in)' }} />
          อยู่ในเป้าหมาย
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--chart-over)' }} />
          ส่วนที่เกิน
        </span>
      </div>
    </div>
  )
}
