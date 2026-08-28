import { requirePatientPage } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { MobileNav, Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { IconBook, IconChart, IconHome, IconList, IconMeal, IconUser } from '@/components/icons'

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePatientPage()

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { fullName: true, patient: { select: { hn: true } } },
  })

  const nav = [
    { href: '/patient/dashboard', label: 'หน้าหลัก', icon: <IconHome /> },
    { href: '/patient/meals', label: 'บันทึกอาหาร', icon: <IconMeal /> },
    { href: '/patient/health', label: 'สุขภาพของฉัน', icon: <IconUser /> },
    { href: '/patient/weekly', label: 'สรุปรายสัปดาห์', icon: <IconChart /> },
    { href: '/patient/foods', label: 'เสนออาหารใหม่', icon: <IconList /> },
    { href: '/patient/knowledge', label: 'ความรู้', icon: <IconBook /> },
  ]

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        items={nav}
        tip={{
          title: 'เคล็ดลับ',
          body: 'ควรแบ่งมื้ออาหาร 3 มื้อหลักและของว่างหากจำเป็น เพื่อช่วยให้ควบคุมโปรตีนในแต่ละมื้อได้ง่ายขึ้น',
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
          user={{ fullName: user.fullName, subtitle: `HN ${user.patient?.hn ?? '-'}` }}
        />
        <MobileNav items={nav} />
        <main className="flex-1 p-4 pb-16 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
