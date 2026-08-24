import { AppNav } from '@/components/app-nav'
import { requireAdminPage } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

const ROLE_LABELS = {
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
  ADMIN: 'ผู้ดูแล',
  USER: 'ผู้ป่วย',
}

const NAV = [
  { href: '/admin/patients', label: 'ผู้ป่วย' },
  { href: '/admin/foods', label: 'อาหาร' },
  { href: '/admin/protein-rules', label: 'กฎโปรตีน' },
  { href: '/admin/knowledge', label: 'บทความ' },
  { href: '/admin/users', label: 'ผู้ใช้' },
  { href: '/admin/settings', label: 'ตั้งค่า' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage()
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { fullName: true },
  })

  const nav =
    session.role === 'SUPER_ADMIN'
      ? [...NAV, { href: '/admin/audit-logs', label: 'Audit Log' }]
      : NAV

  return (
    <>
      <AppNav
        items={nav}
        user={{ fullName: user.fullName, roleLabel: ROLE_LABELS[session.role] }}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-16">{children}</main>
    </>
  )
}
