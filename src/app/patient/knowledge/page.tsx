import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db/prisma'
import { requirePatientPage } from '@/lib/auth/guards'
import { EmptyState, PageHeader } from '@/components/ui'
import { excerptOf, hostOf } from '@/lib/knowledge/display'

/** หน้ารวมบทความ = การ์ดย่อ กดเข้าไปอ่านเต็มที่หน้าของบทความนั้น */
export default async function PatientKnowledgePage() {
  await requirePatientPage()

  const articles = await prisma.knowledge.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ความรู้เรื่องโปรตีนและโรคไต"
        description={articles.length > 0 ? `${articles.length} บทความ` : undefined}
      />

      {articles.length === 0 ? (
        <EmptyState>ยังไม่มีบทความเผยแพร่</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                href={`/patient/knowledge/${article.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {article.imageUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden bg-background">
                    {/* การ์ดย่อครอปให้ทุกใบสูงเท่ากัน ส่วนรูปเต็มไม่ครอปอยู่ในหน้าบทความ */}
                    <Image
                      src={article.imageUrl}
                      alt={article.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-brand-tint text-4xl">
                    📖
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h2 className="font-medium group-hover:text-brand">{article.title}</h2>
                  <p className="line-clamp-3 text-sm text-muted">{excerptOf(article.content)}</p>

                  <div className="mt-auto flex items-center gap-2 pt-2 text-sm">
                    <span className="font-medium text-brand">อ่านต่อ →</span>
                    {article.linkUrl ? (
                      <span className="ml-auto truncate text-xs text-muted">
                        🔗 {hostOf(article.linkUrl)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
