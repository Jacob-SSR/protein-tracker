import { redirect } from 'next/navigation'
import { RegisterCard } from '@/components/register-card'
import { isPatientPortalEnabled } from '@/lib/settings'

/**
 * ลิงก์ที่มี HN ต่อท้าย เช่น /register/12345 — เติมช่อง HN ให้อัตโนมัติ
 * ถ้าแนบ ?code=XXXX-XXXX-XXXX มาด้วย จะเติมช่องรหัสเชิญให้ด้วย
 *
 * ไม่ได้ตรวจว่า HN นี้มีจริงไหมโดยตั้งใจ เพราะจะกลายเป็นช่องให้ไล่เดา HN ได้
 * การตรวจจริงเกิดตอนกดสร้างบัญชี ซึ่งต้องมีรหัสเชิญที่ตรงกับ HN นั้นด้วย
 */
export const dynamic = 'force-dynamic'

export default async function RegisterWithHnPage({
  params,
  searchParams,
}: {
  params: Promise<{ hn: string }>
  searchParams: Promise<{ code?: string }>
}) {
  if (!(await isPatientPortalEnabled())) redirect('/login?portal=disabled')
  const [{ hn }, { code }] = await Promise.all([params, searchParams])

  return (
    <RegisterCard
      defaultHn={decodeURIComponent(hn).slice(0, 50)}
      defaultCode={(code ?? '').slice(0, 40)}
    />
  )
}
