import { prisma } from '@/lib/db/prisma'
import { SettingsForm } from '@/components/settings-form'
import { requireAdminPage } from '@/lib/auth/guards'

export default async function AdminSettingsPage() {
  await requireAdminPage()

  const settings = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">ตั้งค่าระบบ</h1>
        <p className="text-sm text-gray-500">แก้ไขได้ทันทีโดยไม่ต้อง deploy ใหม่</p>
      </div>
      <SettingsForm
        settings={settings.map((setting) => ({
          key: setting.key,
          value: setting.value,
          valueType: setting.valueType,
          description: setting.description,
        }))}
      />
    </div>
  )
}
