import Image from 'next/image'
import { prisma } from '@/lib/db/prisma'
import { requirePatientPage } from '@/lib/auth/guards'
import { Card, EmptyState, PageHeader } from '@/components/ui'

/** ชื่อเว็บของลิงก์ ใช้เป็นข้อความสำรองเมื่อไม่ได้ตั้งชื่อลิงก์เอง */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

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
        articles.map((article) => {
          const linkLabel = article.linkUrl
            ? (article.linkLabel ?? `อ่านต่อที่ ${hostOf(article.linkUrl)}`)
            : null

          return (
            <Card key={article.id} title={article.title}>
              <div className="flex flex-col gap-4">
                {article.imageUrl ? (
                  <ArticleImage src={article.imageUrl} alt={article.title} href={article.linkUrl} />
                ) : null}

                <div className="whitespace-pre-wrap text-sm leading-relaxed">{article.content}</div>

                {article.linkUrl ? (
                  <a
                    href={article.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-brand transition hover:bg-background"
                  >
                    {linkLabel}
                    <span aria-hidden>↗</span>
                  </a>
                ) : null}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}

/**
 * กดที่รูปแล้วไปเว็บไซต์ต้นทาง ไม่ใช่ไปเปิดไฟล์รูปบน Cloudinary
 * ไม่มีลิงก์ก็แสดงรูปเฉยๆ กดไม่ได้ — ดีกว่าพาไปหน้าไฟล์รูปเปล่าๆ ที่ไม่มีประโยชน์
 */
/**
 * กดที่รูปแล้วไปเว็บไซต์ต้นทาง ไม่ใช่ไปเปิดไฟล์รูปบน Cloudinary
 * ไม่มีลิงก์ก็แสดงรูปเฉยๆ กดไม่ได้ — ดีกว่าพาไปหน้าไฟล์รูปเปล่าๆ ที่ไม่มีประโยชน์
 */
function ArticleImage({ src, alt, href }: { src: string; alt: string; href: string | null }) {
  const image = (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-line sm:h-80">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 720px"
        className="object-cover"
      />
    </div>
  )

  if (!href) return image

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="block transition hover:opacity-90"
      title={`เปิด ${hostOf(href)}`}
    >
      {image}
    </a>
  )
}
