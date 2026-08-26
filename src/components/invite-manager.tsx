'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Input, Table } from '@/components/ui'
import { request } from '@/lib/client/api'

export type InviteStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'

export type InviteRow = {
  id: string
  patientId: string
  patientName: string
  hn: string
  status: InviteStatus
  createdAt: string
  expiresAt: string
  usedAt: string | null
  /** ชื่อผู้ใช้ที่ผู้ป่วยตั้งเองตอนสมัคร — null ถ้ายังไม่มีใครใช้รหัสนี้ */
  usedByUsername: string | null
  createdByName: string
}

const TABS: { key: InviteStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'ACTIVE', label: 'ยังใช้ได้' },
  { key: 'USED', label: 'สมัครแล้ว' },
  { key: 'EXPIRED', label: 'หมดอายุ' },
  { key: 'REVOKED', label: 'ยกเลิกแล้ว' },
]

const STATUS_LABELS: Record<
  InviteStatus,
  { label: string; tone: 'ok' | 'brand' | 'warn' | 'muted' }
> = {
  ACTIVE: { label: 'ยังใช้ได้', tone: 'brand' },
  USED: { label: 'สมัครแล้ว', tone: 'ok' },
  EXPIRED: { label: 'หมดอายุ', tone: 'warn' },
  REVOKED: { label: 'ยกเลิกแล้ว', tone: 'muted' },
}

function thaiDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('th-TH') : '—'
}

/** รวมคำเชิญของทุกคนไว้ที่เดียว — ดูได้ว่าใครสมัครไปแล้ว ใครยังไม่ได้สมัคร */
export function InviteManager({ invites }: { invites: InviteRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<InviteStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [issued, setIssued] = useState<{ hn: string; code: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const keyword = query.trim().toLowerCase()
  const visible = invites
    .filter((invite) => tab === 'ALL' || invite.status === tab)
    .filter(
      (invite) =>
        keyword === '' ||
        invite.patientName.toLowerCase().includes(keyword) ||
        invite.hn.toLowerCase().includes(keyword) ||
        (invite.usedByUsername ?? '').toLowerCase().includes(keyword),
    )

  function linkOf(hn: string) {
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    return `${origin}/register/${encodeURIComponent(hn)}`
  }

  /** มือถือเปิดชีตแชร์ของเครื่อง เดสก์ท็อปถอยไปคัดลอกลง clipboard */
  async function shareUrl(url: string, hn: string, withCode: boolean) {
    setError(null)
    setNotice(null)
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ลงทะเบียนผู้ป่วย — Protein Tracker',
          text: withCode
            ? `เปิดลิงก์นี้เพื่อตั้งชื่อผู้ใช้และรหัสผ่านของคุณ (HN ${hn})`
            : `เปิดลิงก์นี้เพื่อตั้งบัญชีของคุณ (HN ${hn}) แล้วกรอกรหัสเชิญที่เจ้าหน้าที่แจ้งไว้`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setNotice(withCode ? `คัดลอกลิงก์พร้อมรหัสแล้ว` : `คัดลอกลิงก์ของ HN ${hn} แล้ว`)
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') return
      setError('แชร์ไม่สำเร็จ กรุณาคัดลอกลิงก์เอง')
    }
  }

  async function reissue(invite: InviteRow) {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      const data = await request<{ invite: { code: string; expiresAt: string } }>(
        `/api/patients/${invite.patientId}/invite`,
        { method: 'POST' },
      )
      setIssued({ hn: invite.hn, ...data.invite })
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function revoke(invite: InviteRow) {
    if (!window.confirm(`ยกเลิกรหัสเชิญของ ${invite.patientName} (HN ${invite.hn})?`)) return
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${invite.patientId}/invite`, { method: 'DELETE' })
      setNotice('ยกเลิกรหัสเชิญแล้ว')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}

      {issued ? (
        <Card title={`รหัสเชิญใหม่ของ HN ${issued.hn}`} className="border-brand">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-brand">
              แสดงครั้งเดียวเท่านั้น ออกจากหน้านี้แล้วดูย้อนไม่ได้
            </p>
            <p className="tabular text-2xl font-semibold tracking-widest text-brand">
              {issued.code}
            </p>
            <p className="text-sm text-muted">
              หมดอายุ {thaiDateTime(issued.expiresAt)} · ใช้ได้ครั้งเดียว
            </p>
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted">
                ลิงก์พร้อมรหัส — ผู้ป่วยกรอกแค่ชื่อผู้ใช้กับรหัสผ่าน
              </p>
              <p className="break-all text-sm font-medium">
                {linkOf(issued.hn)}?code={issued.code}
              </p>
            </div>
            <p className="text-sm text-muted">
              ลิงก์พร้อมรหัสสะดวกกว่า แต่ใครที่เห็นลิงก์นั้นก็สมัครแทนผู้ป่วยได้ทันที —
              ถ้าส่งผ่านช่องทางที่มีคนอื่นเห็นด้วย ให้แชร์ลิงก์ไม่มีรหัสแล้วโทรบอกรหัสแยก
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void shareUrl(
                    `${linkOf(issued.hn)}?code=${encodeURIComponent(issued.code)}`,
                    issued.hn,
                    true,
                  )
                }
              >
                แชร์ลิงก์พร้อมรหัส
              </Button>
              <Button
                variant="secondary"
                onClick={() => void shareUrl(linkOf(issued.hn), issued.hn, false)}
              >
                แชร์ลิงก์ไม่มีรหัส
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(issued.code)
                  setNotice('คัดลอกรหัสแล้ว')
                }}
              >
                คัดลอกรหัส
              </Button>
              <Button variant="ghost" onClick={() => setIssued(null)}>
                ปิด
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        title="คำเชิญลงทะเบียน"
        description="ออกรหัสเชิญได้ที่หน้าผู้ป่วยแต่ละราย — หน้านี้ไว้ดูภาพรวมว่าใครสมัครไปแล้วบ้าง"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((item) => {
              const count =
                item.key === 'ALL'
                  ? invites.length
                  : invites.filter((invite) => invite.status === item.key).length
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    tab === item.key
                      ? 'bg-brand-soft font-medium text-brand'
                      : 'text-muted hover:bg-background'
                  }`}
                >
                  {item.label} ({count})
                </button>
              )
            })}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ / HN / ชื่อผู้ใช้"
              className="ml-auto w-64"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState>ไม่มีคำเชิญในหมวดนี้</EmptyState>
          ) : (
            <Table head={['ผู้ป่วย', 'สถานะ', 'สมัครเมื่อ / ชื่อผู้ใช้', 'หมดอายุ', 'ออกโดย', '']}>
              {visible.map((invite) => (
                <tr key={invite.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/patients/${invite.patientId}`}
                      className="font-medium text-brand underline"
                    >
                      {invite.patientName}
                    </Link>
                    <p className="text-xs text-muted">HN {invite.hn}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_LABELS[invite.status].tone}>
                      {STATUS_LABELS[invite.status].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {invite.usedAt ? (
                      <>
                        <p className="tabular">{thaiDateTime(invite.usedAt)}</p>
                        <p className="text-xs text-muted">
                          ชื่อผู้ใช้ {invite.usedByUsername ?? '—'}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted">ยังไม่ได้สมัคร</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2">{thaiDateTime(invite.expiresAt)}</td>
                  <td className="px-3 py-2">
                    <p>{invite.createdByName}</p>
                    <p className="text-xs text-muted">{thaiDateTime(invite.createdAt)}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      {invite.status === 'ACTIVE' ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => void shareUrl(linkOf(invite.hn), invite.hn, false)}
                          >
                            แชร์ลิงก์
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => void revoke(invite)}
                            disabled={pending}
                          >
                            ยกเลิก
                          </Button>
                        </>
                      ) : invite.status === 'USED' ? (
                        <span className="text-xs text-muted">สมัครเรียบร้อยแล้ว</span>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => void reissue(invite)}
                          disabled={pending}
                        >
                          ออกรหัสใหม่
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}
