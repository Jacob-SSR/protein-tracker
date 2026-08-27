/** ชื่อเว็บของลิงก์ ใช้เป็นข้อความสำรองเมื่อไม่ได้ตั้งชื่อลิงก์เอง */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function linkLabelOf(article: { linkUrl: string | null; linkLabel: string | null }) {
  if (!article.linkUrl) return null
  return article.linkLabel ?? `อ่านต่อที่ ${hostOf(article.linkUrl)}`
}

/** ตัวอย่างเนื้อหาบนการ์ด — ตัดที่ขอบคำ ไม่ตัดกลางคำ */
export function excerptOf(content: string, max = 140): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
