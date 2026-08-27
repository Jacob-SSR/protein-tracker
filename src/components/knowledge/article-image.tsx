'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

/**
 * รูปประกอบบทความ
 *
 * แสดงเต็มรูปตามสัดส่วนจริง ไม่ครอป — ใช้ขนาดที่ Cloudinary ส่งมาตอนอัปโหลด
 * รูปเก่าที่ยังไม่มีขนาดเก็บไว้ ถอยไปใช้กล่องสูงจำกัดแบบ object-contain
 * ยังเห็นครบทั้งรูปเหมือนกัน แค่จองพื้นที่ล่วงหน้าไม่ได้
 *
 * กดที่รูป = เปิดรูปเต็มจอ ส่วนลิงก์เว็บไซต์แยกเป็นปุ่มของตัวเอง
 * ตั้งใจไม่เอาสองอย่างมารวมที่รูป เพราะกดทีเดียวแล้วเดาไม่ออกว่าจะไปไหน
 */
export function ArticleImage({
  src,
  alt,
  width,
  height,
}: {
  src: string
  alt: string
  width: number | null
  height: number | null
}) {
  const [zoomed, setZoomed] = useState(false)

  // ปิดด้วย Esc และล็อกไม่ให้หน้าข้างหลังเลื่อนตอนเปิดรูปเต็มจอ
  useEffect(() => {
    if (!zoomed) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false)
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [zoomed])

  const hasSize = Boolean(width && height)

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative block w-full overflow-hidden rounded-xl border border-line bg-background"
        title="กดเพื่อดูรูปเต็ม"
      >
        {hasSize ? (
          <Image
            src={src}
            alt={alt}
            width={width!}
            height={height!}
            sizes="(max-width: 768px) 100vw, 720px"
            className="h-auto w-full"
          />
        ) : (
          <span className="relative block h-72 w-full sm:h-96">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-contain"
            />
          </span>
        )}

        <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
          🔍 ดูรูปเต็ม
        </span>
      </button>

      {zoomed ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
          >
            ปิด ✕
          </button>

          {/* ขนาดยังไม่รู้ก็ให้เบราว์เซอร์จัดเอง ที่นี่เน้นเห็นเต็มรูปเป็นหลัก */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}
