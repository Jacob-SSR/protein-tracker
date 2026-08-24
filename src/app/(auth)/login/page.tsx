import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-brand">Protein Tracker</h1>
          <p className="mt-1 text-sm text-muted">ระบบติดตามการบริโภคโปรตีนสำหรับผู้ป่วยโรคไต</p>
        </div>
        {/* LoginForm ใช้ useSearchParams (?next=) จึงต้องอยู่ใน Suspense boundary */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
