'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, Modal } from '@/components/ui'
import { request } from '@/lib/client/api'

/**
 * ลบข้อมูลผู้ป่วย — แยกสองระดับโดยตั้งใจ
 * เก็บเข้าคลัง = ซ่อนจากรายชื่อ กู้คืนได้ ใช้กับผู้ป่วยที่ไม่ได้รักษาต่อแล้ว
 * ลบถาวร = ข้อมูลหายจริง เฉพาะ SUPER_ADMIN และต้องพิมพ์ HN ยืนยัน
 */
export function PatientDangerZone({
  patientId,
  hn,
  fullName,
  isActive,
  canDeletePermanently,
  counts,
}: {
  patientId: string
  hn: string
  fullName: string
  isActive: boolean
  canDeletePermanently: boolean
  counts: { measurements: number; labs: number; calculations: number; mealItems: number }
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'archive' | 'delete' | null>(null)
  const [confirmHn, setConfirmHn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function toggleArchive() {
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${patientId}`, {
        method: 'PATCH',
        json: { isActive: !isActive },
      })
      setMode(null)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function deleteForever() {
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${patientId}`, {
        method: 'DELETE',
        json: { confirmHn },
      })
      router.replace('/admin/patients')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
      setPending(false)
    }
  }

  return (
    <Card
      title="ลบข้อมูลผู้ป่วย"
      description="เก็บเข้าคลังก่อนเสมอถ้าไม่แน่ใจ — กู้คืนได้ทุกเมื่อ"
      className="border-danger/30"
    >
      <div className="flex flex-col gap-3">
        {error && !mode ? <Alert>{error}</Alert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3">
          <div className="text-sm">
            <p className="font-medium">{isActive ? 'เก็บเข้าคลัง' : 'กู้คืนผู้ป่วย'}</p>
            <p className="text-muted">
              {isActive
                ? 'ซ่อนจากรายชื่อผู้ป่วยที่ใช้งานอยู่ ข้อมูลทั้งหมดยังอยู่ครบ'
                : 'ตอนนี้อยู่ในคลัง กดเพื่อนำกลับมาใช้งาน'}
            </p>
          </div>
          <Button
            variant={isActive ? 'secondary' : 'primary'}
            onClick={toggleArchive}
            disabled={pending}
          >
            {isActive ? 'เก็บเข้าคลัง' : 'กู้คืน'}
          </Button>
        </div>

        {canDeletePermanently ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3">
            <div className="text-sm">
              <p className="font-medium text-danger">ลบถาวร</p>
              <p className="text-danger/80">
                ข้อมูลสุขภาพและประวัติการกินทั้งหมดหายถาวร กู้คืนไม่ได้
              </p>
            </div>
            <Button variant="danger" onClick={() => setMode('delete')} disabled={pending}>
              ลบถาวร
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">การลบถาวรทำได้เฉพาะ SUPER_ADMIN</p>
        )}
      </div>

      {mode === 'delete' ? (
        <Modal
          tone="danger"
          title="ลบผู้ป่วยถาวร"
          description="การกระทำนี้ย้อนกลับไม่ได้"
          onClose={() => setMode(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setMode(null)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button
                variant="danger"
                onClick={deleteForever}
                disabled={pending || confirmHn !== hn}
              >
                {pending ? 'กำลังลบ...' : 'ลบถาวร'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p>
              กำลังจะลบ <strong>{fullName}</strong> (HN {hn}) พร้อมข้อมูลทั้งหมด:
            </p>
            <ul className="flex flex-col gap-1 rounded-lg bg-background p-3 tabular">
              <li>ประวัติน้ำหนัก/ส่วนสูง {counts.measurements} รายการ</li>
              <li>ผลเลือด {counts.labs} รายการ</li>
              <li>ประวัติเป้าหมายโปรตีน {counts.calculations} รายการ</li>
              <li>รายการอาหารที่บันทึกไว้ {counts.mealItems} รายการ</li>
            </ul>
            <p className="text-muted">
              ระบบจะบันทึกสรุปการลบลง Audit Log ไว้ก่อนลบ และประวัติการแก้ไขรายการอาหาร
              (MealItemHistory) จะยังอยู่เพื่อการตรวจสอบย้อนหลัง
            </p>

            <Field label={`พิมพ์ HN "${hn}" เพื่อยืนยัน`}>
              <Input
                value={confirmHn}
                onChange={(event) => setConfirmHn(event.target.value)}
                autoComplete="off"
                placeholder={hn}
              />
            </Field>

            {error ? <Alert>{error}</Alert> : null}
          </div>
        </Modal>
      ) : null}
    </Card>
  )
}
