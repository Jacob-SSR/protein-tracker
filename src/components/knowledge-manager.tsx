'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Textarea,
} from '@/components/ui'
import { KnowledgeImageField, type ArticleMedia } from '@/components/knowledge-image-field'
import { request } from '@/lib/client/api'

type Article = {
  id: string
  slug: string
  title: string
  content: string
  imageUrl: string | null
  imagePublicId: string | null
  imageWidth: number | null
  imageHeight: number | null
  linkUrl: string | null
  linkLabel: string | null
  version: number
  isPublished: boolean
  author: string
  createdAt: string
}

type Draft = ArticleMedia & {
  slug: string
  title: string
  content: string
  isPublished: boolean
  isNew: boolean
}

const emptyMedia: ArticleMedia = {
  imageUrl: null,
  imagePublicId: null,
  imageWidth: null,
  imageHeight: null,
  linkUrl: '',
  linkLabel: '',
}

function mediaOf(article: Article): ArticleMedia {
  return {
    imageUrl: article.imageUrl,
    imagePublicId: article.imagePublicId,
    imageWidth: article.imageWidth,
    imageHeight: article.imageHeight,
    linkUrl: article.linkUrl ?? '',
    linkLabel: article.linkLabel ?? '',
  }
}

export function KnowledgeManager({
  articles,
  cloudinaryReady,
}: {
  articles: Article[]
  cloudinaryReady: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<{
    slug: string
    title: string
    versions: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // จัดกลุ่มตาม slug แล้วเอาเวอร์ชันล่าสุดขึ้นก่อน
  const bySlug = new Map<string, Article[]>()
  for (const article of articles) {
    bySlug.set(article.slug, [...(bySlug.get(article.slug) ?? []), article])
  }

  async function save() {
    if (!draft) return
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      const media = {
        imageUrl: draft.imageUrl,
        imagePublicId: draft.imagePublicId,
        imageWidth: draft.imageWidth,
        imageHeight: draft.imageHeight,
        linkUrl: draft.linkUrl.trim() || null,
        linkLabel: draft.linkLabel.trim() || null,
      }

      if (draft.isNew) {
        await request('/api/knowledge', {
          method: 'POST',
          json: {
            slug: draft.slug.trim(),
            title: draft.title.trim(),
            content: draft.content,
            ...media,
            isPublished: draft.isPublished,
          },
        })
      } else {
        await request(`/api/knowledge/${draft.slug}`, {
          method: 'POST',
          json: {
            title: draft.title.trim(),
            content: draft.content,
            ...media,
            isPublished: draft.isPublished,
          },
        })
      }
      setDraft(null)
      setNotice(draft.isNew ? 'สร้างบทความแล้ว' : 'บันทึกเป็นเวอร์ชันใหม่แล้ว')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      const result = await request<{
        deleted: { versions: number }
        images: { deleted: number; failed: string[] }
      }>(`/api/knowledge/${deleting.slug}`, { method: 'DELETE' })

      const parts = [`ลบ "${deleting.title}" แล้ว (${result.deleted.versions} เวอร์ชัน)`]
      if (result.images.deleted > 0) parts.push(`ลบรูปบน Cloudinary ${result.images.deleted} ไฟล์`)
      if (result.images.failed.length > 0) {
        parts.push(`แต่ลบรูปไม่สำเร็จ ${result.images.failed.length} ไฟล์ ต้องไปลบเองใน Cloudinary`)
      }

      setDeleting(null)
      setNotice(parts.join(' · '))
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && !deleting ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}

      {draft ? (
        <Card title={draft.isNew ? 'เขียนบทความใหม่' : `แก้ไข: ${draft.slug}`}>
          <div className="flex flex-col gap-3">
            {draft.isNew ? (
              <Field label="slug" hint="ใช้ใน URL — a-z 0-9 และ - เช่น protein-basics">
                <Input
                  value={draft.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                />
              </Field>
            ) : null}
            <Field label="หัวข้อ">
              <Input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </Field>
            <Field label="เนื้อหา">
              <Textarea
                rows={12}
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              />
            </Field>
            <KnowledgeImageField
              media={draft}
              onChange={(media) => setDraft({ ...draft, ...media })}
              cloudinaryReady={cloudinaryReady}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })}
              />
              เผยแพร่ให้ผู้ป่วยเห็น (เวอร์ชันเก่าจะถูกปลดเผยแพร่อัตโนมัติ)
            </label>
            <div className="flex gap-2">
              <Button
                onClick={save}
                disabled={pending || !draft.title.trim() || !draft.content.trim()}
              >
                บันทึก
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        title={`บทความทั้งหมด (${bySlug.size})`}
        actions={
          draft ? null : (
            <Button
              onClick={() =>
                setDraft({
                  slug: '',
                  title: '',
                  content: '',
                  ...emptyMedia,
                  isPublished: false,
                  isNew: true,
                })
              }
            >
              + เขียนบทความ
            </Button>
          )
        }
      >
        {bySlug.size === 0 ? (
          <EmptyState>ยังไม่มีบทความ</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...bySlug.entries()].map(([slug, versions]) => {
              const latest = versions[0]
              return (
                <li key={slug} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        {latest.title}
                        <Badge tone={versions.some((row) => row.isPublished) ? 'ok' : 'muted'}>
                          {versions.some((row) => row.isPublished) ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                        </Badge>
                      </p>
                      <p className="font-mono text-xs text-muted">{slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          setDraft({
                            slug,
                            title: latest.title,
                            content: latest.content,
                            ...mediaOf(latest),
                            isPublished: latest.isPublished,
                            isNew: false,
                          })
                        }
                      >
                        แก้ไข
                      </Button>
                      <Button
                        variant="danger"
                        disabled={pending}
                        onClick={() =>
                          setDeleting({
                            slug,
                            title: latest.title,
                            versions: versions.length,
                          })
                        }
                      >
                        ลบ
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                    {versions.map((version) => (
                      <li key={version.id}>
                        v{version.version} ·{' '}
                        {new Date(version.createdAt).toLocaleDateString('th-TH')} · {version.author}
                        {version.isPublished ? ' · กำลังเผยแพร่' : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {deleting ? (
        <Modal
          tone="danger"
          title={`ลบบทความ "${deleting.title}"`}
          description="การกระทำนี้ย้อนกลับไม่ได้"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button variant="danger" onClick={remove} disabled={pending}>
                {pending ? 'กำลังลบ...' : 'ลบถาวร'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            {error ? <Alert>{error}</Alert> : null}
            <p>
              จะลบ <strong>ทุกเวอร์ชัน</strong> ของบทความนี้ ({deleting.versions} เวอร์ชัน)
              ผู้ป่วยจะไม่เห็นบทความนี้อีก
            </p>
            <p className="text-muted">
              ไฟล์รูปบน Cloudinary ถูกลบตามไปด้วย เฉพาะรูปที่ไม่มีบทความอื่นใช้อยู่ —
              รูปที่ใช้ร่วมกับบทความอื่นจะไม่ถูกแตะ
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
