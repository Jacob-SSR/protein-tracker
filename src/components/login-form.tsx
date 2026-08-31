'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { request } from '@/lib/client/api'

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
    try {
      const data = await request<{ user: { role: string } }>('/api/auth/login', {
        method: 'POST',
        json: {
          username: form.get('username'),
          password: form.get('password'),
        },
      })

      const next = searchParams.get('next')
      const fallback = data.user.role === 'USER' ? '/patient/dashboard' : '/admin/patients'
      router.replace(next && next.startsWith('/') ? next : fallback)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="ชื่อผู้ใช้" required>
        <Input name="username" required autoComplete="username" />
      </Field>
      <Field label="รหัสผ่าน" required>
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      {error ? <Alert>{error}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </Button>
    </form>
  )
}
