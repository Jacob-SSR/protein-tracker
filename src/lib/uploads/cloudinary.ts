import { createHash } from 'node:crypto'
import { badRequest } from '@/lib/errors'

/**
 * อัปโหลดรูปขึ้น Cloudinary แบบ signed
 *
 * ไฟล์รูปไม่วิ่งผ่าน server ของเรา — เบราว์เซอร์ยิงตรงไป Cloudinary
 * เราแค่เซ็นลายเซ็นให้ API secret จึงไม่เคยหลุดไปฝั่ง client
 * และไม่ต้องชน body size limit ของ serverless
 */

export const UPLOAD_FOLDER = 'protein-tracker/knowledge'
/** จำกัดชนิดไฟล์ตั้งแต่ต้นทาง — Cloudinary เองก็ตรวจซ้ำอีกชั้น */
export const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw badRequest(
      'CLOUDINARY_NOT_CONFIGURED',
      'ยังไม่ได้ตั้งค่า Cloudinary — ใส่ CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ใน .env ก่อน',
    )
  }

  return { cloudName, apiKey, apiSecret }
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  )
}

/**
 * ลายเซ็นตามสเปกของ Cloudinary: เรียง key ตามตัวอักษร ต่อเป็น query string
 * แล้ว sha1 ของ (string + api_secret)
 */
export function signUploadParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex')
}

/**
 * รับเฉพาะ URL ที่เป็นของ cloud เราเท่านั้น
 * ถ้าไม่ตรวจ ใครยิง API ตรงๆ ก็ใส่ URL รูปจากที่ไหนก็ได้ลงบทความที่ผู้ป่วยเห็น
 */
export function assertOwnCloudinaryUrl(url: string, cloudName: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw badRequest('INVALID_IMAGE_URL', 'ลิงก์รูปไม่ถูกต้อง')
  }

  const validHost = parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com'
  const validCloud = parsed.pathname.startsWith(`/${cloudName}/`)
  if (!validHost || !validCloud) {
    throw badRequest('INVALID_IMAGE_URL', 'รับเฉพาะรูปที่อัปโหลดผ่านระบบเท่านั้น')
  }

  return parsed.toString()
}

/**
 * ลิงก์ปลายทางของบทความ — รับเฉพาะ http/https
 * กัน javascript: และ data: ที่เอาไปทำ XSS ได้ตอนผู้ป่วยกดที่รูป
 */
export function assertSafeExternalUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw badRequest('INVALID_LINK_URL', 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw badRequest('INVALID_LINK_URL', 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http:// เท่านั้น')
  }

  return parsed.toString()
}

/**
 * ลบไฟล์ออกจาก Cloudinary
 *
 * เรียกหลังลบแถวใน DB แล้วเท่านั้น และคืน public_id ที่ลบไม่สำเร็จกลับมา
 * ตั้งใจไม่ให้ throw — DB เป็นแหล่งความจริง ถ้าลบไฟล์พลาดก็แค่มีไฟล์ค้าง
 * ไม่ควรทำให้การลบบทความทั้งก้อนล้มเหลวตาม
 */
export async function destroyImages(publicIds: string[]): Promise<{ failed: string[] }> {
  if (publicIds.length === 0) return { failed: [] }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`
  const failed: string[] = []

  for (const publicId of publicIds) {
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const form = new FormData()
      form.append('public_id', publicId)
      form.append('api_key', apiKey)
      form.append('timestamp', String(timestamp))
      form.append('signature', signUploadParams({ public_id: publicId, timestamp }, apiSecret))

      const response = await fetch(endpoint, { method: 'POST', body: form })
      const payload = (await response.json()) as { result?: string }
      // "not found" = ไฟล์ถูกลบไปแล้ว ถือว่าสำเร็จตามที่ตั้งใจ
      if (!response.ok || (payload.result !== 'ok' && payload.result !== 'not found')) {
        failed.push(publicId)
      }
    } catch {
      failed.push(publicId)
    }
  }

  return { failed }
}
