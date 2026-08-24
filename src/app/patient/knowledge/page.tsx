import { prisma } from '@/lib/db/prisma'
import { requirePatientPage } from '@/lib/auth/guards'
import { Card, EmptyState, PageHeader } from '@/components/ui'

export default async function PatientKnowledgePage() {
  await requirePatientPage()

  const articles = await prisma.knowledge.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="ความรู้เรื่องโปรตีนและโรคไต" />
      {articles.length === 0 ? (
        <EmptyState>ยังไม่มีบทความเผยแพร่</EmptyState>
      ) : (
        articles.map((article) => (
          <Card key={article.id} title={article.title}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{article.content}</div>
          </Card>
        ))
      )}
    </div>
  )
}
