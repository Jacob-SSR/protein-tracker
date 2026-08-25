'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Setting = {
  key: string
  value: string
  valueType: string
  description: string | null
}

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  )
  const [message, setMessage] = useState<string | null>(null)

  async function save(key: string) {
    setMessage(null)
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: drafts[key] }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setMessage(payload?.error?.message ?? 'บันทึกไม่สำเร็จ')
      return
    }
    setMessage(`บันทึก ${key} แล้ว`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      {settings.map((setting) => (
        <div key={setting.key} className="flex flex-col gap-1 rounded border p-3 text-sm">
          <label className="font-medium" htmlFor={setting.key}>
            {setting.key} <span className="font-normal text-gray-500">({setting.valueType})</span>
          </label>
          {setting.description ? <p className="text-gray-500">{setting.description}</p> : null}
          <div className="flex gap-2">
            <input
              id={setting.key}
              value={drafts[setting.key] ?? ''}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))
              }
              className="flex-1 rounded border p-2 font-mono"
            />
            <button
              type="button"
              onClick={() => save(setting.key)}
              className="rounded bg-black px-3 text-white"
            >
              บันทึก
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
