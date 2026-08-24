'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui'
import { request } from '@/lib/client/api'

/**
 * เปิด/ปิดสิทธิ์ให้ผู้ป่วยล็อกอินเข้ามาดูข้อมูลตัวเอง
 * การ์ดนี้จะแสดงก็ต่อเมื่อเปิด "ส่วนของผู้ป่วย" ในหน้าตั้งค่าระบบแล้วเท่านั้น
 */
export function PatientAccountPanel({
  patientId,
  username,
}: {
  patientId: string
  username: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)
    const data = new FormData(event.currentTarget)
    try {
      await request(`/api/patients/${patientId}/account`, {
        method: 'POST',
        json: {
          username: String(data.get('username')).trim(),
          password: String(data.get('password')),
        },
      })
      setOpen(false)
      setNotice('เปิดสิทธิ์เข้าระบบให้ผู้ป่วยแล้ว')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function revoke() {
    if (!window.confirm('ปิดสิทธิ์เข้าระบบของผู้ป่วยรายนี้?')) return
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${patientId}/account`, { method: 'DELETE' })
      setNotice('ปิดสิทธิ์แล้ว — ข้อมูลและประวัติทั้งหมดยังอยู่ครบ')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      title="สิทธิ์เข้าระบบของผู้ป่วย"
      description="ไม่จำเป็นต้องเปิด — เจ้าหน้าที่บันทึกข้อมูลแทนได้อยู่แล้ว"
      actions={
        username ? (
          <Button variant="danger" onClick={revoke} disabled={pending}>
            ปิดสิทธิ์
          </Button>
        ) : open ? null : (
          <Button onClick={() => setOpen(true)}>เปิดสิทธิ์</Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}

        {username ? (
          <p className="text-sm">
            เข้าระบบได้ด้วยชื่อผู้ใช้ <Badge tone="brand">{username}</Badge>
          </p>
        ) : open ? (
          <form onSubmit={grant} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ชื่อผู้ใช้" hint="a-z 0-9 . _ - อย่างน้อย 3 ตัว">
                <Input name="username" required minLength={3} autoComplete="off" />
              </Field>
              <Field label="รหัสผ่านเริ่มต้น" hint="อย่างน้อย 8 ตัวอักษร">
                <Input name="password" type="password" required minLength={8} autoComplete="off" />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                เปิดสิทธิ์
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">ผู้ป่วยรายนี้ยังเข้าระบบเองไม่ได้</p>
        )}
      </div>
    </Card>
  )
}
