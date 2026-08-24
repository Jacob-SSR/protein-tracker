import { AppNav } from '@/components/app-nav'
import { requirePatientPage } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

const NAV = [
  { href: '/patient/dashboard', label: 'วันนี้' },
  { href: '/patient/meals', label: 'บันทึกอาหาร' },
  { href: '/patient/weekly', label: 'รายสัปดาห์' },
  { href: '/patient/foods', label: 'เสนออาหารใหม่' },
  { href: '/patient/knowledge', label: 'ความรู้' },
]

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePatientPage()
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { fullName: true, patient: { select: { hn: true } } },
  })

  return (
    <>
      <AppNav
        items={NAV}
        user={{
          fullName: user.fullName,
          roleLabel: `HN ${user.patient?.hn ?? '-'}`,
        }}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-16">{children}</main>
    </>
  )
}
