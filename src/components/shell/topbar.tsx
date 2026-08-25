'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconBell, IconCalendar } from '@/components/icons'
import { LogoutButton } from '@/components/logout-button'

/** ชื่อหน้าอ่านจาก path ตรงๆ จะได้ไม่ต้องส่ง title ผ่านทุกหน้า */
const TITLES: Record<string, string> = {
  '/patient/dashboard': 'บันทึกการบริโภคโปรตีน',
  '/patient/meals': 'บันทึกอาหาร',
  '/patient/weekly': 'สรุปรายสัปดาห์',
  '/patient/foods': 'เสนออาหารใหม่',
  '/patient/knowledge': 'ความรู้',
  '/admin/patients': 'ผู้ป่วย',
  '/admin/foods': 'ฐานข้อมูลอาหาร',
  '/admin/protein-rules': 'กฎคำนวณโปรตีน',
  '/admin/knowledge': 'บทความความรู้',
  '/admin/users': 'ผู้ใช้',
  '/admin/settings': 'ตั้งค่าระบบ',
  '/admin/audit-logs': 'Audit Log',
}

export function Topbar({
  todayLabel,
  user,
  alert,
}: {
  todayLabel: string
  user: { fullName: string; subtitle: string }
  alert?: { count: number; href: string }
}) {
  const pathname = usePathname()
  const title =
    TITLES[pathname] ??
    Object.entries(TITLES).find(([href]) => pathname.startsWith(`${href}/`))?.[1] ??
    'KidneyCare'

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:px-6">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <IconCalendar />
          {todayLabel}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {alert && alert.count > 0 ? (
          <Link
            href={alert.href}
            className="relative rounded-lg p-2 text-muted transition hover:bg-background hover:text-foreground"
            aria-label={`มี ${alert.count} รายการรอดำเนินการ`}
          >
            <IconBell />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
              {alert.count}
            </span>
          </Link>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-medium text-brand">
            {user.fullName.slice(0, 1)}
          </span>
          <span className="hidden text-sm leading-tight sm:block">
            <span className="block font-medium">{user.fullName}</span>
            <span className="block text-xs text-muted">{user.subtitle}</span>
          </span>
        </div>

        <LogoutButton />
      </div>
    </header>
  )
}
