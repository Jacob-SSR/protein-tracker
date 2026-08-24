'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui'

type Threshold = {
  percent: number
  level: 'INFO' | 'WARN' | 'DANGER'
  message: string
}
type Meta = Record<string, { at: string; by: string | null } | undefined>

const LEVELS: { value: Threshold['level']; label: string }[] = [
  { value: 'INFO', label: 'แจ้งให้ทราบ' },
  { value: 'WARN', label: 'เตือน' },
  { value: 'DANGER', label: 'อันตราย' },
]

const LEVEL_TONE = { INFO: 'brand', WARN: 'warn', DANGER: 'danger' } as const

async function saveSetting(key: string, value: string) {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message ?? 'บันทึกไม่สำเร็จ')
}

function UpdatedNote({ meta }: { meta?: { at: string; by: string | null } }) {
  if (!meta) return null
  return (
    <span className="text-xs text-muted">
      แก้ไขล่าสุด {new Date(meta.at).toLocaleString('th-TH')}
      {meta.by ? ` โดย ${meta.by}` : ''}
    </span>
  )
}

export function SettingsEditor({
  backdateDays,
  futureDays,
  thresholds,
  updatedBy,
}: {
  backdateDays: number
  futureDays: number
  thresholds: Threshold[]
  updatedBy: Meta
}) {
  return (
    <div className="flex flex-col gap-4">
      <BackdateCard initial={backdateDays} meta={updatedBy['meal_backdate_days']} />
      <FutureCard initial={futureDays} meta={updatedBy['meal_future_days']} />
      <ThresholdCard initial={thresholds} meta={updatedBy['notify_thresholds']} />
    </div>
  )
}

/** -1 = ไม่จำกัด, 0 = วันนี้เท่านั้น, n = ย้อนหลัง n วัน — ซ่อนตัวเลขพิเศษไว้หลัง UI */
function BackdateCard({ initial, meta }: { initial: number; meta?: Meta[string] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'unlimited' | 'today' | 'limited'>(
    initial === -1 ? 'unlimited' : initial === 0 ? 'today' : 'limited',
  )
  const [days, setDays] = useState(initial > 0 ? String(initial) : '7')
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({})
  const [pending, setPending] = useState(false)

  const value = mode === 'unlimited' ? -1 : mode === 'today' ? 0 : Number(days)

  async function save() {
    setState({})
    setPending(true)
    try {
      await saveSetting('meal_backdate_days', String(value))
      setState({ saved: true })
      router.refresh()
    } catch (cause) {
      setState({ error: (cause as Error).message })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      title="การบันทึกอาหารย้อนหลัง"
      description="ผู้ป่วยย้อนกลับไปบันทึกอาหารของวันก่อนหน้าได้ไกลแค่ไหน"
      actions={
        <Button onClick={save} disabled={pending || (mode === 'limited' && !(Number(days) > 0))}>
          บันทึก
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              {
                key: 'unlimited',
                label: 'ไม่จำกัด',
                hint: 'ย้อนหลังได้ทุกวัน',
              },
              {
                key: 'today',
                label: 'วันนี้เท่านั้น',
                hint: 'ห้ามย้อนหลังเลย',
              },
              {
                key: 'limited',
                label: 'กำหนดจำนวนวัน',
                hint: 'ย้อนหลังได้ไม่เกิน N วัน',
              },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                mode === option.key
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:bg-background'
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-muted">{option.hint}</span>
            </button>
          ))}
        </div>

        {mode === 'limited' ? (
          <Field label="ย้อนหลังได้ไม่เกิน (วัน)" className="max-w-40">
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="tabular"
            />
          </Field>
        ) : null}

        <p className="text-sm text-muted">
          ผลลัพธ์:{' '}
          <strong className="text-foreground">
            {mode === 'unlimited'
              ? 'ผู้ป่วยบันทึกย้อนหลังได้ไม่จำกัด'
              : mode === 'today'
                ? 'ผู้ป่วยบันทึกได้เฉพาะอาหารของวันนี้'
                : `ผู้ป่วยบันทึกย้อนหลังได้ไม่เกิน ${days || 0} วัน`}
          </strong>
        </p>

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.saved ? <Alert tone="ok">บันทึกแล้ว</Alert> : null}
        <UpdatedNote meta={meta} />
      </div>
    </Card>
  )
}

function FutureCard({ initial, meta }: { initial: number; meta?: Meta[string] }) {
  const router = useRouter()
  const [days, setDays] = useState(String(initial))
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({})
  const [pending, setPending] = useState(false)

  async function save() {
    setState({})
    setPending(true)
    try {
      await saveSetting('meal_future_days', String(Number(days)))
      setState({ saved: true })
      router.refresh()
    } catch (cause) {
      setState({ error: (cause as Error).message })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      title="การบันทึกอาหารล่วงหน้า"
      description="โดยปกติควรเป็น 0 — บันทึกสิ่งที่ยังไม่ได้กินทำให้ยอดรวมของวันเพี้ยน"
      actions={
        <Button onClick={save} disabled={pending}>
          บันทึก
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="ล่วงหน้าได้ไม่เกิน (วัน)" className="max-w-40">
          <Input
            type="number"
            min={0}
            max={30}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="tabular"
          />
        </Field>
        <p className="text-sm text-muted">
          {Number(days) === 0
            ? 'ผลลัพธ์: ห้ามบันทึกล่วงหน้า'
            : `ผลลัพธ์: บันทึกล่วงหน้าได้ไม่เกิน ${days} วัน`}
        </p>
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.saved ? <Alert tone="ok">บันทึกแล้ว</Alert> : null}
        <UpdatedNote meta={meta} />
      </div>
    </Card>
  )
}

/** ตารางแก้เกณฑ์แจ้งเตือน — ข้างหลังยังเก็บเป็น JSON แต่ admin ไม่ต้องเห็น JSON เลย */
function ThresholdCard({ initial, meta }: { initial: Threshold[]; meta?: Meta[string] }) {
  const router = useRouter()
  const [rows, setRows] = useState<Threshold[]>([...initial].sort((a, b) => a.percent - b.percent))
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({})
  const [pending, setPending] = useState(false)

  function update(index: number, patch: Partial<Threshold>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  async function save() {
    setState({})
    setPending(true)
    try {
      const sorted = [...rows].sort((a, b) => a.percent - b.percent)
      await saveSetting('notify_thresholds', JSON.stringify(sorted))
      setRows(sorted)
      setState({ saved: true })
      router.refresh()
    } catch (cause) {
      setState({ error: (cause as Error).message })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      title="เกณฑ์แจ้งเตือนโปรตีนรายวัน"
      description="ผู้ป่วยจะเห็นข้อความของเกณฑ์สูงสุดที่ถึงแล้วในหน้าสรุปรายวัน"
      actions={
        <Button onClick={save} disabled={pending || rows.length === 0}>
          บันทึก
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
          >
            <Field label="เมื่อถึง (%)" className="w-28">
              <Input
                type="number"
                min={1}
                max={500}
                value={row.percent}
                onChange={(event) => update(index, { percent: Number(event.target.value) })}
                className="tabular"
              />
            </Field>
            <Field label="ระดับ" className="w-40">
              <Select
                value={row.level}
                onChange={(event) =>
                  update(index, {
                    level: event.target.value as Threshold['level'],
                  })
                }
              >
                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ข้อความที่ผู้ป่วยเห็น" className="min-w-60 flex-1">
              <Input
                value={row.message}
                onChange={(event) => update(index, { message: event.target.value })}
              />
            </Field>
            <div className="flex items-center gap-2 pb-2">
              <Badge tone={LEVEL_TONE[row.level]}>{row.percent}%</Badge>
              <Button
                variant="ghost"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                ลบ
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="secondary"
          className="self-start"
          onClick={() =>
            setRows((current) => [...current, { percent: 100, level: 'WARN', message: '' }])
          }
        >
          + เพิ่มเกณฑ์
        </Button>

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.saved ? <Alert tone="ok">บันทึกแล้ว</Alert> : null}
        <UpdatedNote meta={meta} />
      </div>
    </Card>
  )
}
