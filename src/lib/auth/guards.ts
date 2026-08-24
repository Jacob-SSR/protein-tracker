import { redirect } from 'next/navigation'
import { getSession } from './session'
import { isAdmin } from '@/lib/permissions'
import type { AccessTokenPayload } from './jwt'

/**
 * ใช้ในทุกหน้า server component ของ /admin
 * proxy.ts เป็นแค่ optimistic check — หน้าที่ดึงข้อมูลจริงต้องตรวจสิทธิ์เองอีกชั้นเสมอ
 * (ผลพลอยได้: การอ่าน cookie ทำให้หน้าเป็น dynamic ไม่ถูก prerender ตอน build)
 */
export async function requireAdminPage(): Promise<AccessTokenPayload> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/patient/dashboard')
  return session
}

export async function requirePatientPage(): Promise<AccessTokenPayload & { patientId: string }> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.patientId) redirect('/admin/patients')
  return session as AccessTokenPayload & { patientId: string }
}
