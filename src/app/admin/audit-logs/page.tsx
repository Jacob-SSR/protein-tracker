import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { canReadAuditLog } from '@/lib/permissions'
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui'

const ACTION_TONE = (action: string) =>
  action.includes('DELETE') || action.includes('REJECT')
    ? 'danger'
    : action.includes('CREATE') || action.includes('APPROVE')
      ? 'ok'
      : 'brand'

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string }>
}) {
  const session = await requireAdminPage()
  // อ่าน Audit Log ได้เฉพาะ SUPER_ADMIN และไม่มีทางลบผ่านหน้าจอไหนทั้งสิ้น
  if (!canReadAuditLog(session)) redirect('/admin/patients')

  const { targetType } = await searchParams

  const logs = await prisma.auditLog.findMany({
    where: targetType ? { targetType } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { fullName: true, username: true } } },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Log"
        description="บันทึกอย่างเดียว แก้หรือลบไม่ได้ — แสดง 200 รายการล่าสุด"
      />
      <Card>
        {logs.length === 0 ? (
          <EmptyState>ยังไม่มีบันทึก</EmptyState>
        ) : (
          <Table head={['เวลา', 'ผู้กระทำ', 'การกระทำ', 'เป้าหมาย', 'รายละเอียด']}>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-line align-top last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">
                  {log.createdAt.toLocaleString('th-TH')}
                </td>
                <td className="px-3 py-2 text-sm">
                  {log.actor ? log.actor.fullName : 'ระบบ'}
                  <span className="block font-mono text-xs text-muted">
                    {log.actor?.username ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={ACTION_TONE(log.action)}>{log.action}</Badge>
                </td>
                <td className="px-3 py-2 text-xs">
                  {log.targetType}
                  <span className="block font-mono text-muted">{log.targetId ?? '—'}</span>
                </td>
                <td className="max-w-md px-3 py-2">
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">ดูค่าก่อน/หลัง</summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[11px]">
                      {JSON.stringify({ old: log.oldValue, new: log.newValue }, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
