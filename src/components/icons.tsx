/** ไอคอนเส้นชุดเล็ก วาดเองทั้งหมด ไม่พึ่ง icon library ภายนอก */
type IconProps = { className?: string }

const base = 'h-5 w-5 shrink-0'

export function IconHome({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTarget({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2" strokeLinecap="round" />
    </svg>
  )
}

export function IconMeal({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3c-1.5 1.5-2 3.5-2 5.5S15 12 16.5 12H17V3z" strokeLinejoin="round" />
      <path d="M17 12v9" strokeLinecap="round" />
    </svg>
  )
}

export function IconList({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  )
}

export function IconChart({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 20V11M12 20V4M19 20v-6" strokeLinecap="round" />
    </svg>
  )
}

export function IconClock({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconUser({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconBook({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 4.5h9a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H5z" strokeLinejoin="round" />
      <path d="M19 6.5V20" strokeLinecap="round" />
    </svg>
  )
}

export function IconSettings({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconShield({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSearch({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  )
}

export function IconCalendar({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" strokeLinecap="round" />
    </svg>
  )
}

export function IconBell({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15z" strokeLinejoin="round" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  )
}

export function IconKidney({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M14.5 5c3.4 0 5.5 2.6 5.5 6.2 0 2.4-1.2 3.6-2.6 4.4-1.1.6-1.7 1-1.7 1.9 0 .9.7 1.4 1.5 1.9 1.3.8 2.8 1.7 2.8 4.1 0 3-2.4 5-5.4 5C10.6 28.5 7 24 7 17.5 7 10.4 10.4 5 14.5 5z"
        fill="currentColor"
      />
      <path
        d="M24.5 9c2.3 0 3.5 1.8 3.5 4.2 0 1.6-.8 2.4-1.7 2.9-.7.4-1.1.7-1.1 1.3 0 .6.4.9 1 1.3.8.5 1.8 1.1 1.8 2.7 0 2-1.6 3.3-3.5 3.3-1.6 0-2.8-1-2.8-1l.4-.7c.7-1 1-1.9 1-2.9 0-1.6-.8-2.7-1.7-3.4.9-.8 1.6-2 1.6-3.7 0-1.4-.4-2.7-1.1-3.7A4.4 4.4 0 0 1 24.5 9z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  )
}
