import { requireAdminPage } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { MobileNav, Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import {
  IconBook,
  IconChart,
  IconList,
  IconClock,
  IconSettings,
  IconShield,
  IconTarget,
  IconUser,
} from '@/components/icons'

const ROLE_LABELS = { SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด', ADMIN: 'ผู้ดูแล', USER: 'ผู้ป่วย' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage()

  const [user, pendingFoods] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { fullName: true },
    }),
    prisma.food.count({ where: { status: 'PENDING' } }),
  ])

  const nav = [
    { href: '/admin/patients', label: 'ผู้ป่วย', icon: <IconUser /> },
    { href: '/admin/invites', label: 'คำเชิญลงทะเบียน', icon: <IconClock /> },
    { href: '/admin/foods', label: 'ฐานข้อมูลอาหาร', icon: <IconList /> },
    { href: '/admin/protein-rules', label: 'กฎคำนวณโปรตีน', icon: <IconTarget /> },
    { href: '/admin/knowledge', label: 'บทความความรู้', icon: <IconBook /> },
    { href: '/admin/users', label: 'ผู้ใช้', icon: <IconChart /> },
    { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: <IconSettings /> },
    ...(session.role === 'SUPER_ADMIN'
      ? [{ href: '/admin/audit-logs', label: 'Audit Log', icon: <IconShield /> }]
      : []),
  ]

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        items={nav}
        tip={{
          title: 'เคล็ดลับ',
          body: 'กรอกส่วนสูงและเพศให้ครบ จะตั้งกฎคำนวณด้วยน้ำหนักอุดมคติได้ แม่นกว่าน้ำหนักจริงในผู้ป่วยที่มีน้ำหนักเกิน',
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          todayLabel={new Date().toLocaleDateString('th-TH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          user={{ fullName: user.fullName, subtitle: ROLE_LABELS[session.role] }}
          alert={{ count: pendingFoods, href: '/admin/foods' }}
        />
        <MobileNav items={nav} />
        <main className="flex-1 p-4 pb-16 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
