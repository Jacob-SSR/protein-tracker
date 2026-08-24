import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <nav className="flex gap-4 text-sm">
          <Link href="/patient/dashboard">วันนี้</Link>
          <Link href="/patient/meals">บันทึกอาหาร</Link>
          <Link href="/patient/weekly">รายสัปดาห์</Link>
        </nav>
        <LogoutButton />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
    </div>
  )
}
