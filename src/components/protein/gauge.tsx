/** เกจครึ่งวงกลมแสดงความคืบหน้าของวัน — ตัวเลขอยู่กลางเกจ ไม่ต้องมีแกน */
export function ProgressGauge({ consumed, target }: { consumed: number; target: number | null }) {
  const percent = target && target > 0 ? (consumed / target) * 100 : 0
  const capped = Math.min(percent, 100)
  const over = target !== null && consumed > target

  // ครึ่งวงกลมรัศมี 80 จากซ้าย (180°) ไปขวา (0°)
  const radius = 80
  const circumference = Math.PI * radius
  const dash = (capped / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 116"
        className="w-full max-w-[220px]"
        role="img"
        aria-label={`ทานโปรตีนแล้ว ${consumed} กรัม จากเป้าหมาย ${target ?? '-'} กรัม`}
      >
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--border)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {target ? (
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={over ? 'var(--danger)' : 'var(--chart-in)'}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        ) : null}
        <text
          x="100"
          y="88"
          textAnchor="middle"
          className="tabular fill-foreground"
          style={{ fontSize: 30, fontWeight: 600 }}
        >
          {consumed}
          <tspan className="fill-muted" style={{ fontSize: 18, fontWeight: 400 }}>
            {target ? ` / ${target}` : ''}
          </tspan>
        </text>
        <text x="100" y="108" textAnchor="middle" className="fill-muted" style={{ fontSize: 12 }}>
          กรัม
        </text>
      </svg>
      <p className="mt-1 text-sm text-muted">
        {target ? `${Math.round(percent)}% ของเป้าหมาย` : 'ยังไม่กำหนดเป้าหมาย'}
      </p>
    </div>
  )
}
