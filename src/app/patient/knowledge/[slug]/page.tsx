import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requirePatientPage } from '@/lib/auth/guards'
import { ArticleImage } from '@/components/knowledge/article-image'
import { RichText } from '@/components/knowledge/rich-text'
import { linkLabelOf } from '@/lib/knowledge/display'

/** บทความเต็ม — รูปแสดงเต็มไม่ครอป กดดูเต็มจอได้ และมีปุ่มไปเว็บไซต์ต้นทาง */
export default async function PatientArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requirePatientPage()
  const { slug } = await params

  const article = await prisma.knowledge.findFirst({
    where: { slug, isPublished: true },
    orderBy: { version: 'desc' },
  })
  if (!article) notFound()

  const linkLabel = linkLabelOf(article)

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/patient/knowledge" className="text-sm text-muted transition hover:text-brand">
        ← กลับไปหน้ารวมบทความ
      </Link>

      <header>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(article.createdAt).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      {article.imageUrl ? (
        <ArticleImage
          src={article.imageUrl}
          alt={article.title}
          width={article.imageWidth}
          height={article.imageHeight}
        />
      ) : null}

      <RichText content={article.content} />

      {article.linkUrl ? (
        <a
          href={article.linkUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-medium text-white transition hover:opacity-90"
        >
          {linkLabel}
          <span aria-hidden>↗</span>
        </a>
      ) : null}
    </article>
  )
}
