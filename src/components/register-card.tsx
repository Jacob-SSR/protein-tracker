import Link from 'next/link'
import { RegisterForm } from '@/components/register-form'

/** กล่องลงทะเบียน ใช้ร่วมกันทั้ง /register และ /register/[hn] */
export function RegisterCard({
  defaultHn,
  defaultCode,
}: {
  defaultHn?: string
  defaultCode?: string
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-brand">ลงทะเบียนผู้ป่วย</h1>
          <p className="mt-1 text-sm text-muted">
            ใช้รหัสเชิญที่ได้รับจากเจ้าหน้าที่ เพื่อตั้งชื่อผู้ใช้และรหัสผ่านของคุณเอง
          </p>
        </div>

        <RegisterForm defaultHn={defaultHn} defaultCode={defaultCode} />

        <p className="mt-4 text-center text-sm text-muted">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="text-brand underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  )
}
