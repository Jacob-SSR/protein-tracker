'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-foreground disabled:opacity-50"
      onClick={async () => {
        setPending(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        router.replace('/login')
        router.refresh()
      }}
    >
      ออกจากระบบ
    </button>
  )
}
