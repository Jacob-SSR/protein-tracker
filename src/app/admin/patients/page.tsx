import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'

export default async function AdminPatientsPage() {
  await requireAdminPage()

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      hn: true,
      isActive: true,
      user: { select: { fullName: true } },
      calculations: {
        where: { effectiveTo: null },
        select: { proteinTargetGrams: true, effectiveFrom: true },
        take: 1,
      },
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">ผู้ป่วย</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">HN</th>
            <th className="p-2">ชื่อ</th>
            <th className="p-2">เป้าหมายโปรตีน</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id} className="border-b">
              <td className="p-2">{patient.hn}</td>
              <td className="p-2">{patient.user.fullName}</td>
              <td className="p-2">
                {patient.calculations[0]
                  ? `${patient.calculations[0].proteinTargetGrams.toString()} g`
                  : 'ยังไม่กำหนด'}
              </td>
              <td className="p-2">
                <Link href={`/admin/patients/${patient.id}`} className="underline">
                  จัดการ
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {patients.length === 0 ? (
        <p className="text-sm text-gray-500">ยังไม่มีผู้ป่วยในระบบ</p>
      ) : null}
    </div>
  )
}
