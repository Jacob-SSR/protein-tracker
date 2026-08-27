'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { request } from '@/lib/client/api'

export type ArticleMedia = {
  imageUrl: string | null
  imagePublicId: string | null
  imageWidth: number | null
  imageHeight: number | null
  linkUrl: string
  linkLabel: string
}

type UploadTicket = {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
  endpoint: string
  allowedFormats: string[]
  maxBytes: number
}

/**
 * เลือกรูป -> ขอลายเซ็นจาก server -> อัปโหลดตรงไป Cloudinary
 * ไฟล์ไม่ผ่าน server ของเรา จึงไม่ติด body size limit และ API secret ไม่หลุด
 */
export function KnowledgeImageField({
  media,
  onChange,
  cloudinaryReady,
}: {
  media: ArticleMedia
  onChange: (media: ArticleMedia) => void
  /** false = ยังไม่ได้ตั้งค่า Cloudinary — บอกตั้งแต่แรก ดีกว่าปล่อยให้กดแล้วเจอ error */
  cloudinaryReady: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  /**
   * ไฟล์ที่เพิ่งอัปโหลดแล้วถูกเปลี่ยน/เอาออกก่อนกดบันทึก จะไม่มีบทความไหนอ้างถึง
   * เก็บกวาดทิ้งเลย ไม่งั้นไฟล์ขยะสะสมบน Cloudinary
   * ฝั่ง server เช็คอีกชั้นว่ารูปนั้นไม่ถูกใช้งานอยู่จริง ถึงจะยอมลบ
   */
  async function discardUnusedUpload(publicId: string | null) {
    if (!publicId) return
    try {
      await request('/api/uploads/image', { method: 'DELETE', json: { publicId } })
    } catch {
      // ลบไฟล์ขยะไม่สำเร็จไม่ใช่เรื่องที่ต้องไปกวนคนเขียนบทความ
    }
  }

  async function upload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const { upload: ticket } = await request<{ upload: UploadTicket }>('/api/uploads/signature', {
        method: 'POST',
      })

      if (file.size > ticket.maxBytes) {
        throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(ticket.maxBytes / 1024 / 1024)} MB`)
      }
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ticket.allowedFormats.includes(extension)) {
        throw new Error(`รับเฉพาะไฟล์ ${ticket.allowedFormats.join(', ')}`)
      }

      const form = new FormData()
      form.append('file', file)
      form.append('api_key', ticket.apiKey)
      form.append('timestamp', String(ticket.timestamp))
      form.append('folder', ticket.folder)
      form.append('signature', ticket.signature)

      const response = await fetch(ticket.endpoint, { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'อัปโหลดรูปไม่สำเร็จ')
      }

      // เปลี่ยนรูป: เก็บกวาดรูปเดิมที่ยังไม่ได้บันทึกลงบทความ
      void discardUnusedUpload(media.imagePublicId)

      onChange({
        ...media,
        imageUrl: payload.secure_url,
        imagePublicId: payload.public_id,
        // เก็บขนาดจริงไว้ด้วย ฝั่งแสดงผลจะได้ไม่ต้องเดาสัดส่วนแล้วครอปรูป
        imageWidth: payload.width ?? null,
        imageHeight: payload.height ?? null,
      })
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-background p-3">
      <p className="text-sm font-medium">
        รูปประกอบและลิงก์
        <span className="ml-2 font-normal text-muted">ไม่บังคับ</span>
      </p>

      {error ? <Alert>{error}</Alert> : null}
      {cloudinaryReady ? null : (
        <Alert tone="warn">
          ยังอัปโหลดรูปไม่ได้ — ต้องตั้งค่า CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
          CLOUDINARY_API_SECRET ใน .env ก่อน (ส่วนลิงก์ใช้ได้ตามปกติ)
        </Alert>
      )}

      {media.imageUrl ? (
        <div className="flex flex-wrap items-start gap-3">
          <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg border border-line">
            <Image
              src={media.imageUrl}
              alt="รูปประกอบบทความ"
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">อัปโหลดแล้ว</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                เปลี่ยนรูป
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={uploading}
                onClick={() => {
                  void discardUnusedUpload(media.imagePublicId)
                  onChange({
                    ...media,
                    imageUrl: null,
                    imagePublicId: null,
                    imageWidth: null,
                    imageHeight: null,
                  })
                }}
              >
                เอารูปออก
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={uploading || !cloudinaryReady}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? 'กำลังอัปโหลด...' : '+ เลือกรูป'}
        </Button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ลิงก์เว็บไซต์" hint="กดที่รูปแล้วจะไปที่ลิงก์นี้ ไม่ใช่ไปเปิดไฟล์รูป">
          <Input
            type="url"
            value={media.linkUrl}
            onChange={(event) => onChange({ ...media, linkUrl: event.target.value })}
            placeholder="https://www.example.com/article"
          />
        </Field>
        <Field label="ข้อความของลิงก์" hint="ไม่ใส่ก็ได้ ระบบจะใช้ชื่อเว็บแทน">
          <Input
            value={media.linkLabel}
            onChange={(event) => onChange({ ...media, linkLabel: event.target.value })}
            placeholder="อ่านบทความต้นฉบับ"
          />
        </Field>
      </div>
    </div>
  )
}
