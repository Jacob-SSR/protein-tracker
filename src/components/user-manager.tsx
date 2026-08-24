'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, Select, Table } from '@/components/ui'
import { request } from '@/lib/client/api'

type Row = {
  id: string
  username: string
  fullName: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'
  isActive: boolean
  hn: string | null
  lastLoginAt: string | null
}

const ROLE_LABELS: Record<Row['role'], string> = {
  SUPER_ADMIN: 'ผู้ดูแลสูงสุด',
  ADMIN: 'ผู้ดูแล',
  USER: 'ผู้ป่วย',
}

export function UserManager({
  users,
  canManageAdmins,
  currentUserId,
}: {
  users: Row[]
  canManageAdmins: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [role, setRole] = useState<Row['role']>('USER')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<void>, successMessage: string) {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      await action()
      setNotice(successMessage)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const role = String(form.get('role')) as Row['role']
    const weight = Number(form.get('weightKg'))
    const height = Number(form.get('heightCm'))

    const body = {
      username: String(form.get('username')).trim(),
      password: String(form.get('password')),
      fullName: String(form.get('fullName')).trim(),
      role,
      patient:
        role === 'USER'
          ? {
              hn: String(form.get('hn')).trim(),
              birthDate: String(form.get('birthDate') || ''),
              gender: (String(form.get('gender')) || undefined) as 'MALE' | 'FEMALE' | 'OTHER',
              weightKg: weight > 0 ? weight : undefined,
              heightCm: height > 0 ? height : undefined,
            }
          : undefined,
    }

    const formElement = event.currentTarget
    await run(async () => {
      await request('/api/users', { method: 'POST', json: body })
      formElement.reset()
    }, 'สร้างบัญชีแล้ว')
  }

  async function toggleActive(user: Row) {
    await run(
      () =>
        request(`/api/users/${user.id}`, {
          method: 'PATCH',
          json: { isActive: !user.isActive },
        }).then(() => undefined),
      user.isActive ? 'ปิดใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว',
    )
  }

  async function resetPassword(user: Row) {
    const password = window.prompt(`ตั้งรหัสผ่านใหม่ให้ ${user.fullName} (อย่างน้อย 8 ตัวอักษร)`)
    if (!password) return
    await run(
      () =>
        request(`/api/users/${user.id}/password`, {
          method: 'PUT',
          json: { password },
        }).then(() => undefined),
      'รีเซ็ตรหัสผ่านแล้ว',
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="สร้างบัญชีใหม่">
        <form onSubmit={create} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อผู้ใช้" hint="a-z 0-9 . _ - อย่างน้อย 3 ตัว">
              <Input name="username" required minLength={3} autoComplete="off" />
            </Field>
            <Field label="รหัสผ่านเริ่มต้น" hint="อย่างน้อย 8 ตัวอักษร">
              <Input name="password" type="password" required minLength={8} autoComplete="off" />
            </Field>
            <Field label="ชื่อ-นามสกุล">
              <Input name="fullName" required />
            </Field>
            <Field label="ประเภทบัญชี">
              <Select
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Row['role'])}
              >
                <option value="USER">ผู้ป่วย</option>
                {canManageAdmins ? <option value="ADMIN">ผู้ดูแล</option> : null}
                {canManageAdmins ? <option value="SUPER_ADMIN">ผู้ดูแลสูงสุด</option> : null}
              </Select>
            </Field>
          </div>

          {role === 'USER' ? (
            <div className="grid gap-3 rounded-lg bg-background p-3 sm:grid-cols-3">
              <Field label="HN">
                <Input name="hn" required />
              </Field>
              <Field label="วันเกิด">
                <Input name="birthDate" type="date" />
              </Field>
              <Field label="เพศ">
                <Select name="gender" defaultValue="">
                  <option value="">ไม่ระบุ</option>
                  <option value="MALE">ชาย</option>
                  <option value="FEMALE">หญิง</option>
                  <option value="OTHER">อื่นๆ</option>
                </Select>
              </Field>
              <Field label="น้ำหนัก (kg)" hint="ใส่ตอนนี้เพื่อคำนวณเป้าหมายได้เลย">
                <Input name="weightKg" type="number" step="0.1" min="1" className="tabular" />
              </Field>
              <Field label="ส่วนสูง (cm)">
                <Input name="heightCm" type="number" step="0.1" min="1" className="tabular" />
              </Field>
            </div>
          ) : null}

          {error ? <Alert>{error}</Alert> : null}
          {notice ? <Alert tone="ok">{notice}</Alert> : null}

          <Button type="submit" disabled={pending} className="self-start">
            สร้างบัญชี
          </Button>
        </form>
      </Card>

      <Card title={`บัญชีทั้งหมด (${users.length})`}>
        <Table head={['ชื่อผู้ใช้', 'ชื่อ-นามสกุล', 'ประเภท', 'สถานะ', 'เข้าใช้ล่าสุด', '']}>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-line last:border-0">
              <td className="px-3 py-2 font-mono text-xs">{user.username}</td>
              <td className="px-3 py-2">
                {user.fullName}
                {user.hn ? <span className="ml-2 text-xs text-muted">HN {user.hn}</span> : null}
              </td>
              <td className="px-3 py-2">
                <Badge tone={user.role === 'USER' ? 'muted' : 'brand'}>
                  {ROLE_LABELS[user.role]}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <Badge tone={user.isActive ? 'ok' : 'danger'}>
                  {user.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                </Badge>
              </td>
              <td className="px-3 py-2 text-xs text-muted">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString('th-TH')
                  : 'ยังไม่เคยเข้า'}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" disabled={pending} onClick={() => resetPassword(user)}>
                    รีเซ็ตรหัสผ่าน
                  </Button>
                  <Button
                    variant={user.isActive ? 'danger' : 'secondary'}
                    disabled={pending || user.id === currentUserId}
                    onClick={() => toggleActive(user)}
                  >
                    {user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
