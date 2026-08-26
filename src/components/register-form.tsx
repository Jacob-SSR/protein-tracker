'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { request } from '@/lib/client/api'

/**
 * ลงทะเบียนด้วยรหัสเชิญ — ไม่ใช่การสมัครเสรี
 * ต้องมีทั้งรหัสที่เจ้าหน้าที่ออกให้ และ HN ของตัวเอง ถึงจะตั้งบัญชีได้
 */
export function RegisterForm({
  defaultHn = '',
  defaultCode = '',
}: {
  defaultHn?: string
  defaultCode?: string
}) {
  const router = useRouter()
  // มาจากลิงก์แบบ ?code= — ล็อกไว้เหมือน HN ผู้ป่วยไม่ต้องพิมพ์และแก้ไม่ได้
  const [code, setCode] = useState(defaultCode)
  const codeLocked = defaultCode !== ''
  // มาจากลิงก์ /register/<HN> — ล็อกไว้ ผู้ป่วยแก้เองไม่ได้
  const [hn, setHn] = useState(defaultHn)
  const hnLocked = defaultHn !== ''
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const ready =
    code.trim().length >= 4 &&
    hn.trim().length > 0 &&
    username.trim().length >= 3 &&
    password.length >= 8 &&
    !mismatch

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await request('/api/auth/register', {
        method: 'POST',
        json: {
          code: code.trim(),
          hn: hn.trim(),
          username: username.trim(),
          password,
          confirmPassword,
        },
      })
      // สมัครเสร็จระบบล็อกอินให้แล้ว เข้าหน้าผู้ป่วยได้เลย
      router.replace('/patient/dashboard')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error ? <Alert>{error}</Alert> : null}

      <Field
        label="รหัสเชิญ"
        hint={
          codeLocked
            ? 'มาจากลิงก์ที่เจ้าหน้าที่ส่งให้ — แก้ไม่ได้'
            : 'รหัส 12 ตัวที่ได้รับจากเจ้าหน้าที่'
        }
      >
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          required
          readOnly={codeLocked}
          aria-readonly={codeLocked}
          className={codeLocked ? 'cursor-not-allowed bg-background text-muted' : ''}
        />
      </Field>

      <Field
        label="HN"
        hint={hnLocked ? 'มาจากลิงก์ที่เจ้าหน้าที่ส่งให้ — แก้ไม่ได้' : 'เลขประจำตัวผู้ป่วยของคุณ'}
      >
        <Input
          value={hn}
          onChange={(event) => setHn(event.target.value)}
          autoComplete="off"
          required
          readOnly={hnLocked}
          aria-readonly={hnLocked}
          // readOnly ไม่ใช่ disabled เพราะ disabled จะไม่ถูกอ่านโดย screen reader บางตัว
          className={hnLocked ? 'cursor-not-allowed bg-background text-muted' : ''}
        />
      </Field>

      <Field label="ตั้งชื่อผู้ใช้" hint="a-z 0-9 . _ - อย่างน้อย 3 ตัว">
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </Field>

      <Field label="ตั้งรหัสผ่าน" hint="อย่างน้อย 8 ตัวอักษร">
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="ยืนยันรหัสผ่าน" hint={mismatch ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : undefined}>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          className={mismatch ? 'border-danger' : ''}
          required
        />
      </Field>

      <Button type="submit" disabled={!ready || pending} className="mt-1">
        {pending ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
      </Button>
    </form>
  )
}
