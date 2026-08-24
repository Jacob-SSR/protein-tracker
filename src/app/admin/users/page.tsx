import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui'
import { UserManager } from '@/components/user-manager'

export default async function AdminUsersPage() {
  const session = await requireAdminPage()

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      patient: { select: { hn: true } },
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ผู้ใช้"
        description={
          session.role === 'SUPER_ADMIN'
            ? 'สร้างและจัดการบัญชีทั้งหมด'
            : 'สร้างและจัดการบัญชีผู้ป่วย — บัญชีระดับผู้ดูแลต้องให้ SUPER_ADMIN จัดการ'
        }
      />
      <UserManager
        currentUserId={session.userId}
        canManageAdmins={session.role === 'SUPER_ADMIN'}
        users={users.map((user) => ({
          ...user,
          hn: user.patient?.hn ?? null,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
