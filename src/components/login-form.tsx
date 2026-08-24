'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    })
    const payload = await response.json()
    setPending(false)

    if (!response.ok) {
      setError(payload?.error?.message ?? 'เข้าสู่ระบบไม่สำเร็จ')
      return
    }

    const next = searchParams.get('next')
    const fallback = payload.data.user.role === 'USER' ? '/patient/dashboard' : '/admin/patients'
    router.replace(next && next.startsWith('/') ? next : fallback)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ชื่อผู้ใช้
        <input name="username" required autoComplete="username" className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        รหัสผ่าน
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border p-2"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black p-2 text-white disabled:opacity-50"
      >
        {pending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  )
}
