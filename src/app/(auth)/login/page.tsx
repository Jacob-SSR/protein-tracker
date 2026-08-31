import { APP_NAME } from '@/lib/branding'
import { Suspense } from 'react'
import Link from 'next/link'
import { LoginForm } from '@/components/login-form'
import { isPatientPortalEnabled } from '@/lib/settings'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>
}) {
  const { portal } = await searchParams
  const portalEnabled = await isPatientPortalEnabled()

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-brand">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted">ระบบติดตามการบริโภคโปรตีนสำหรับผู้ป่วยโรคไต</p>
        </div>
        {portal === 'disabled' ? (
          <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            ขณะนี้ยังไม่เปิดให้ผู้ป่วยเข้าใช้งานด้วยตนเอง กรุณาติดต่อเจ้าหน้าที่
          </p>
        ) : null}

        {/* LoginForm ใช้ useSearchParams (?next=) จึงต้องอยู่ใน Suspense boundary */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        {portalEnabled ? (
          <p className="mt-4 text-center text-sm text-muted">
            ผู้ป่วยที่มีรหัสเชิญจากเจ้าหน้าที่{' '}
            <Link href="/register" className="text-brand underline">
              ลงทะเบียนที่นี่
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  )
}
