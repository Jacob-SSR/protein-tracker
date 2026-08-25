'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'

export function AppNav({
  items,
  user,
}: {
  items: { href: string; label: string }[]
  user: { fullName: string; roleLabel: string }
}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="font-semibold text-brand">Protein Tracker</span>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-background'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">
            {user.fullName} · {user.roleLabel}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
