import { prisma } from '@/lib/db/prisma'
import { requireAdminPage } from '@/lib/auth/guards'
import { num } from '@/lib/decimal'
import { PageHeader } from '@/components/ui'
import { RuleManager } from '@/components/rule-manager'

export default async function AdminProteinRulesPage() {
  await requireAdminPage()

  const [rules, comorbidities] = await Promise.all([
    prisma.proteinRule.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }],
      include: { conditions: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.comorbidity.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="กฎคำนวณโปรตีน"
        description="ตรวจจากลำดับความสำคัญน้อยไปมาก กฎแรกที่เงื่อนไขครบทุกข้อคือกฎที่ใช้"
      />
      <RuleManager
        comorbidities={comorbidities.map((row) => ({
          code: row.code,
          name: row.name,
        }))}
        rules={rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          priority: rule.priority,
          version: rule.version,
          isActive: rule.isActive,
          proteinFactor: rule.conditions[0] ? num(rule.conditions[0].proteinFactor) : 1,
          conditions: rule.conditions.map((condition) => ({
            conditionType: condition.conditionType,
            operator: condition.operator,
            value: condition.value,
          })),
        }))}
      />
    </div>
  )
}
