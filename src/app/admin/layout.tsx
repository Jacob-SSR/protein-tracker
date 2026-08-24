import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <nav className="flex gap-4 text-sm">
          <Link href="/admin/patients">ผู้ป่วย</Link>
          <Link href="/admin/foods">อาหารรออนุมัติ</Link>
          <Link href="/admin/settings">ตั้งค่าระบบ</Link>
        </nav>
        <LogoutButton />
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 p-4">{children}</main>
    </div>
  )
}
