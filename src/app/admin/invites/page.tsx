import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui'
import { InviteManager, type InviteRow } from '@/components/invite-manager'
import { inviteStatus } from '@/lib/patients/invites'

/** ภาพรวมคำเชิญลงทะเบียนทั้งระบบ — ใครสมัครไปแล้ว ใครยังค้าง */
export default async function AdminInvitesPage() {
  await requireAdminPage()

  const invites = await prisma.patientInvite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      patient: { select: { id: true, fullName: true, hn: true } },
      createdBy: { select: { fullName: true } },
    },
  })

  // usedByUserId เป็น String ลอยๆ ไม่มี relation — ดึงชื่อผู้ใช้แยกทีเดียวจบ
  const usedIds = invites.map((invite) => invite.usedByUserId).filter((id): id is string => !!id)
  const users = usedIds.length
    ? await prisma.user.findMany({
        where: { id: { in: usedIds } },
        select: { id: true, username: true },
      })
    : []
  const usernameById = new Map(users.map((user) => [user.id, user.username]))

  const rows: InviteRow[] = invites.map((invite) => ({
    id: invite.id,
    patientId: invite.patient.id,
    patientName: invite.patient.fullName,
    hn: invite.patient.hn,
    status: inviteStatus(invite),
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: invite.usedAt?.toISOString() ?? null,
    usedByUsername: invite.usedByUserId ? (usernameById.get(invite.usedByUserId) ?? null) : null,
    createdByName: invite.createdBy.fullName,
  }))

  const registered = rows.filter((row) => row.status === 'USED').length
  const waiting = rows.filter((row) => row.status === 'ACTIVE').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="คำเชิญลงทะเบียน"
        description={`ออกไปแล้ว ${rows.length} ใบ · สมัครแล้ว ${registered} คน · รอสมัคร ${waiting} คน`}
      />
      <InviteManager invites={rows} />
    </div>
  )
}
