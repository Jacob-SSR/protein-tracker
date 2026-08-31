'use client'

import { APP_NAME } from '@/lib/branding'
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
  hn,
  username,
  activeInvite,
}: {
  patientId: string
  hn: string
  username: string | null
  /** รหัสเชิญที่ยังใช้ได้ — ไม่มีตัวรหัส มีแต่วันหมดอายุ */
  activeInvite: { expiresAt: string } | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [issuedCode, setIssuedCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // ประกอบฝั่ง client เพราะ origin จริงรู้ได้จากเบราว์เซอร์เท่านั้น
  const registerLink = `${typeof window === 'undefined' ? '' : window.location.origin}/register/${encodeURIComponent(hn)}`
  // ประกอบได้เฉพาะตอนเพิ่งออกรหัส — ระบบเก็บแค่ hash ของรหัส ย้อนมาสร้างลิงก์นี้อีกไม่ได้
  const linkWithCode = issuedCode
    ? `${registerLink}?code=${encodeURIComponent(issuedCode.code)}`
    : registerLink

  /**
   * มือถือเปิดชีตแชร์ของเครื่อง (LINE / ข้อความ) เดสก์ท็อปถอยไปคัดลอกลง clipboard
   * navigator.share ต้องมาจากการกดของผู้ใช้จริง เรียกใน onClick ตรงๆ เท่านั้น
   */
  async function shareLink(url: string, withCode: boolean) {
    setNotice(null)
    setError(null)
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ลงทะเบียนผู้ป่วย — ${APP_NAME}`,
          text: withCode
            ? `เปิดลิงก์นี้เพื่อตั้งชื่อผู้ใช้และรหัสผ่านของคุณ (HN ${hn})`
            : `เปิดลิงก์นี้เพื่อตั้งบัญชีของคุณ (HN ${hn}) แล้วกรอกรหัสเชิญที่เจ้าหน้าที่แจ้งไว้`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setNotice(withCode ? 'คัดลอกลิงก์พร้อมรหัสแล้ว' : 'คัดลอกลิงก์แล้ว')
    } catch (cause) {
      // ผู้ใช้กดยกเลิกชีตแชร์เอง ไม่ใช่ error ที่ต้องโชว์
      if ((cause as Error).name === 'AbortError') return
      setError('แชร์ไม่สำเร็จ กรุณาคัดลอกลิงก์ด้านบนเอง')
    }
  }

  async function createInvite() {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      const data = await request<{ invite: { code: string; expiresAt: string } }>(
        `/api/patients/${patientId}/invite`,
        { method: 'POST' },
      )
      setIssuedCode(data.invite)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function revokeInvite() {
    if (!window.confirm('ยกเลิกรหัสเชิญของผู้ป่วยรายนี้?')) return
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${patientId}/invite`, { method: 'DELETE' })
      setIssuedCode(null)
      setNotice('ยกเลิกรหัสเชิญแล้ว')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

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
        ) : open || issuedCode ? null : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            ตั้งรหัสผ่านให้เลย
          </Button>
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
        ) : issuedCode ? (
          <div className="flex flex-col gap-2 rounded-lg border border-brand bg-brand-soft p-4">
            <p className="text-sm font-medium text-brand">
              รหัสเชิญ — แสดงครั้งเดียวเท่านั้น ปิดหน้านี้แล้วดูย้อนไม่ได้
            </p>
            <p className="tabular text-2xl font-semibold tracking-widest text-brand">
              {issuedCode.code}
            </p>
            <p className="text-sm text-brand">
              หมดอายุ {new Date(issuedCode.expiresAt).toLocaleString('th-TH')} · ใช้ได้ครั้งเดียว
            </p>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-muted">
                ลิงก์พร้อมรหัส — ผู้ป่วยกรอกแค่ชื่อผู้ใช้กับรหัสผ่าน
              </p>
              <p className="break-all text-sm font-medium">{linkWithCode}</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-muted">ลิงก์ไม่มีรหัส — ต้องบอกรหัสข้างบนแยกอีกทาง</p>
              <p className="break-all text-sm font-medium">{registerLink}</p>
            </div>
            <p className="text-sm text-muted">
              ลิงก์พร้อมรหัสสะดวกกว่า แต่ใครที่เห็นลิงก์นั้นก็สมัครแทนผู้ป่วยได้ทันที —
              ถ้าส่งผ่านช่องทางที่มีคนอื่นเห็นด้วย ให้ใช้ลิงก์ไม่มีรหัสแล้วโทรบอกรหัสแยก
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void shareLink(linkWithCode, true)}>แชร์ลิงก์พร้อมรหัส</Button>
              <Button variant="secondary" onClick={() => void shareLink(registerLink, false)}>
                แชร์ลิงก์ไม่มีรหัส
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(issuedCode.code)
                  setNotice('คัดลอกรหัสแล้ว')
                }}
              >
                คัดลอกรหัส
              </Button>
              <Button variant="ghost" onClick={() => setIssuedCode(null)}>
                ปิด
              </Button>
            </div>
          </div>
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
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">ผู้ป่วยรายนี้ยังเข้าระบบเองไม่ได้</p>

            <div className="flex flex-col gap-3 rounded-lg bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium">ให้ผู้ป่วยตั้งบัญชีเอง (แนะนำ)</p>
                  <p className="text-muted">
                    {activeInvite
                      ? `มีรหัสเชิญที่ใช้ได้อยู่ หมดอายุ ${new Date(activeInvite.expiresAt).toLocaleString('th-TH')}`
                      : 'ออกรหัสเชิญให้ผู้ป่วยไปตั้งชื่อผู้ใช้และรหัสผ่านเอง เจ้าหน้าที่ไม่ต้องรู้รหัสผ่าน'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createInvite} disabled={pending}>
                    {activeInvite ? 'ออกรหัสใหม่' : 'สร้างรหัสเชิญ'}
                  </Button>
                  {activeInvite ? (
                    <Button variant="danger" onClick={revokeInvite} disabled={pending}>
                      ยกเลิกรหัส
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* ลิงก์ไม่ใช่ความลับ (ตัวรหัสต่างหากที่เป็น) จึงโชว์ค้างไว้ได้ ไม่ต้องรอออกรหัสใหม่ */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">ลิงก์ลงทะเบียนของผู้ป่วยรายนี้</p>
                  <p className="break-all text-sm font-medium">{registerLink}</p>
                </div>
                <Button variant="secondary" onClick={() => void shareLink(registerLink, false)}>
                  แชร์ลิงก์
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
