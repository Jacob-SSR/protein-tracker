/** วงแหวนความคืบหน้า วาดด้วย SVG ล้วน — ใช้ร่วมกันทุกการ์ดบนหน้าหลัก จะได้หน้าตาเป็นชุดเดียวกัน */
export function ProgressRing({
  percent,
  tone,
  label,
  ariaLabel,
}: {
  percent: number
  tone: 'info' | 'brand' | 'ok' | 'warn' | 'danger'
  /** ข้อความกลางวง — ไม่ส่งมาจะโชว์เป็นเปอร์เซ็นต์ */
  label?: string
  ariaLabel: string
}) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(percent, 0), 100)
  // อ่านสีจาก design token ชุดเดียวกับที่เหลือของระบบ ไม่ฝังค่าสีไว้ในคอมโพเนนต์
  const stroke = `var(--color-${tone})`

  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          className="text-line"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center tabular text-xl font-semibold">
        {label ?? `${Math.round(percent)}%`}
      </span>
    </div>
  )
}
