import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui'
import { KnowledgeManager } from '@/components/knowledge-manager'

export default async function AdminKnowledgePage() {
  await requireAdminPage()

  const rows = await prisma.knowledge.findMany({
    orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    include: { author: { select: { fullName: true } } },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="บทความความรู้"
        description="แก้ไขแล้วระบบสร้างเวอร์ชันใหม่เสมอ ผู้ป่วยเห็นเฉพาะเวอร์ชันที่เผยแพร่"
      />
      <KnowledgeManager
        articles={rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          content: row.content,
          version: row.version,
          isPublished: row.isPublished,
          author: row.author.fullName,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
