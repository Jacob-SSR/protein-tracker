import { handle, ok, requireSession } from '@/lib/api'
import { ADMIN_ROLES } from '@/lib/permissions'
import {
  ALLOWED_FORMATS,
  MAX_UPLOAD_BYTES,
  UPLOAD_FOLDER,
  getCloudinaryConfig,
  signUploadParams,
} from '@/lib/uploads/cloudinary'

/**
 * ออกลายเซ็นให้เบราว์เซอร์อัปโหลดตรงไป Cloudinary
 *
 * ลายเซ็นผูกกับ folder + timestamp ที่เรากำหนดเอง client เปลี่ยนไม่ได้
 * (ถ้าเปลี่ยน ลายเซ็นจะไม่ตรงแล้ว Cloudinary ปฏิเสธเอง)
 * API secret อยู่ฝั่ง server ที่เดียว ไม่เคยถูกส่งออกไป
 */
export async function POST() {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()

    const timestamp = Math.floor(Date.now() / 1000)
    const params = { folder: UPLOAD_FOLDER, timestamp }

    return ok({
      upload: {
        cloudName,
        apiKey,
        timestamp,
        folder: UPLOAD_FOLDER,
        signature: signUploadParams(params, apiSecret),
        endpoint: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        allowedFormats: ALLOWED_FORMATS,
        maxBytes: MAX_UPLOAD_BYTES,
      },
    })
  })
}
