import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Protein Tracker</h1>
        <p className="text-sm text-gray-500">ระบบติดตามการบริโภคโปรตีนสำหรับผู้ป่วยโรคไต</p>
      </div>
      {/* LoginForm ใช้ useSearchParams (?next=) จึงต้องอยู่ใน Suspense boundary */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
