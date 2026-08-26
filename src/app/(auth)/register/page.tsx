import { redirect } from 'next/navigation'
import { RegisterCard } from '@/components/register-card'
import { isPatientPortalEnabled } from '@/lib/settings'

/**
 * หน้าลงทะเบียนของผู้ป่วย — เปิดใช้ได้เมื่อเปิดส่วนของผู้ป่วยแล้วเท่านั้น
 * ต้องเป็น dynamic เพราะอ่าน SystemSetting จาก DB ถ้าปล่อยให้ prerender ตอน build จะพัง
 */
export const dynamic = 'force-dynamic'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  if (!(await isPatientPortalEnabled())) redirect('/login?portal=disabled')
  const { code } = await searchParams
  return <RegisterCard defaultCode={(code ?? '').slice(0, 40)} />
}
