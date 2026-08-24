import { requireAdminPage } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui'
import { SettingsEditor } from '@/components/settings-editor'
import {
  SETTING_KEYS,
  getMealBackdateDays,
  getMealFutureDays,
  getNotifyThresholds,
} from '@/lib/settings'
import { prisma } from '@/lib/db/prisma'

export default async function AdminSettingsPage() {
  await requireAdminPage()

  const [backdateDays, futureDays, thresholds, rows] = await Promise.all([
    getMealBackdateDays(),
    getMealFutureDays(),
    getNotifyThresholds(),
    prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.MEAL_BACKDATE_DAYS,
            SETTING_KEYS.MEAL_FUTURE_DAYS,
            SETTING_KEYS.NOTIFY_THRESHOLDS,
          ],
        },
      },
      select: {
        key: true,
        updatedAt: true,
        updatedBy: { select: { fullName: true } },
      },
    }),
  ])

  const updatedBy = Object.fromEntries(
    rows.map((row) => [
      row.key,
      { at: row.updatedAt.toISOString(), by: row.updatedBy?.fullName ?? null },
    ]),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ตั้งค่าระบบ"
        description="แก้ไขแล้วมีผลทันที ไม่ต้อง deploy ใหม่ ทุกการเปลี่ยนแปลงถูกบันทึกลง Audit Log"
      />
      <SettingsEditor
        backdateDays={backdateDays}
        futureDays={futureDays}
        thresholds={thresholds}
        updatedBy={updatedBy}
      />
    </div>
  )
}
