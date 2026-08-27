/**
 * แยกข้อความเป็นชิ้นๆ ว่าตรงไหนเป็นลิงก์ ตรงไหนเป็นตัวอักษรธรรมดา
 *
 * คืนเป็น array ให้ฝั่ง React ไปวาดเป็น element เอง ตั้งใจไม่คืน HTML string
 * เพราะถ้าคืน HTML แล้วต้องใช้ dangerouslySetInnerHTML จะกลายเป็นช่อง XSS ทันที
 * (เนื้อหาบทความเป็นข้อความที่คนพิมพ์เข้ามา ไม่ควรถูกตีความเป็น markup)
 *
 * รับเฉพาะ http/https — javascript: กับ data: ไม่ถูกจับเป็นลิงก์
 */

export type TextChunk = { type: 'text' | 'link'; value: string }

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g
/** เครื่องหมายท้ายประโยคที่มักติดมากับลิงก์ ไม่ควรนับเป็นส่วนหนึ่งของ URL */
const TRAILING = /[.,;:!?)\]}"'』」]+$/

export function linkify(text: string): TextChunk[] {
  const chunks: TextChunk[] = []
  let cursor = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    let url = match[0]

    // "ดูที่ https://a.com/x." -> จุดท้ายเป็นของประโยค ไม่ใช่ของลิงก์
    const trailing = url.match(TRAILING)?.[0] ?? ''
    if (trailing) url = url.slice(0, url.length - trailing.length)
    if (!url) continue

    if (start > cursor) chunks.push({ type: 'text', value: text.slice(cursor, start) })
    chunks.push({ type: 'link', value: url })
    cursor = start + url.length
  }

  if (cursor < text.length) chunks.push({ type: 'text', value: text.slice(cursor) })
  return chunks
}
