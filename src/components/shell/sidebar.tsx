'use client'

import { APP_NAME, APP_TAGLINE } from '@/lib/branding'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { IconKidney } from '@/components/icons'

export type NavItem = { href: string; label: string; icon: ReactNode }

export function Sidebar({
  items,
  tip,
}: {
  items: NavItem[]
  tip?: { title: string; body: string }
}) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-brand">
          <IconKidney />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight text-brand">{APP_NAME}</p>
          <p className="text-[11px] leading-tight text-muted">{APP_TAGLINE}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-brand font-medium text-white'
                  : 'text-muted hover:bg-brand-tint hover:text-brand'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {tip ? (
        <div className="m-3 rounded-xl bg-brand-tint p-3">
          <p className="text-sm font-medium text-brand">💡 {tip.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{tip.body}</p>
        </div>
      ) : null}
    </aside>
  )
}

/** เมนูแบบเลื่อนแนวนอนสำหรับจอเล็ก — sidebar ซ่อนไว้ต่ำกว่า lg */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              active ? 'bg-brand font-medium text-white' : 'text-muted'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
