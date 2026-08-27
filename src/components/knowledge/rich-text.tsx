import { linkify } from '@/lib/knowledge/linkify'

/**
 * เนื้อหาบทความ — ลิงก์ที่พิมพ์ไว้ในข้อความกดได้
 * วาดเป็น React element ทีละชิ้น ไม่ได้ยัด HTML เข้าไป ข้อความจึงถูก escape เสมอ
 */
export function RichText({ content }: { content: string }) {
  return (
    <div className="whitespace-pre-wrap text-base leading-relaxed break-words">
      {linkify(content).map((chunk, index) =>
        chunk.type === 'link' ? (
          <a
            key={index}
            href={chunk.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-brand underline decoration-brand/40 underline-offset-2 transition hover:decoration-brand"
          >
            {chunk.value}
          </a>
        ) : (
          <span key={index}>{chunk.value}</span>
        ),
      )}
    </div>
  )
}
