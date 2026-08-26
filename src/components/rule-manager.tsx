'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from '@/components/ui'
import { request } from '@/lib/client/api'

type ConditionType =
  | 'GENDER'
  | 'EGFR'
  | 'ALBUMIN'
  | 'BUN'
  | 'CREATININE'
  | 'POTASSIUM'
  | 'PHOSPHORUS'
  | 'BMI'
  | 'AGE'
  | 'WEIGHT'
  | 'CKD_STAGE'
  | 'COMORBIDITY'
  | 'DIALYSIS'

type Operator = 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ' | 'NEQ'
type WeightBasis = 'ACTUAL' | 'IBW' | 'ADJUSTED' | 'DRY'

type Condition = {
  conditionType: ConditionType
  operator: Operator
  value: string
}

type Rule = {
  id: string
  name: string
  description: string | null
  priority: number
  weightBasis: WeightBasis
  version: number
  isActive: boolean
  proteinFactor: number
  conditions: Condition[]
}

const CONDITION_LABELS: Record<ConditionType, string> = {
  GENDER: 'เพศ',
  EGFR: 'eGFR',
  ALBUMIN: 'Albumin',
  BUN: 'BUN',
  CREATININE: 'Creatinine',
  POTASSIUM: 'Potassium',
  PHOSPHORUS: 'Phosphorus',
  BMI: 'BMI',
  AGE: 'อายุ (ปี)',
  WEIGHT: 'น้ำหนัก (kg)',
  CKD_STAGE: 'ระยะ CKD',
  COMORBIDITY: 'มีโรคร่วม',
  DIALYSIS: 'ฟอกไต',
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'LT', label: 'น้อยกว่า (<)' },
  { value: 'LTE', label: 'น้อยกว่าหรือเท่ากับ (≤)' },
  { value: 'GT', label: 'มากกว่า (>)' },
  { value: 'GTE', label: 'มากกว่าหรือเท่ากับ (≥)' },
  { value: 'EQ', label: 'เท่ากับ (=)' },
  { value: 'NEQ', label: 'ไม่เท่ากับ (≠)' },
]

const WEIGHT_BASIS_OPTIONS: { value: WeightBasis; label: string; hint: string }[] = [
  { value: 'ACTUAL', label: 'น้ำหนักจริง', hint: 'คูณกับน้ำหนักที่ชั่งได้ล่าสุด' },
  {
    value: 'IBW',
    label: 'น้ำหนักอุดมคติ (IBW)',
    hint: 'ชาย = ส่วนสูง − 100, หญิง = ส่วนสูง − 105 — ต้องมีส่วนสูงและเพศของผู้ป่วย',
  },
  {
    value: 'ADJUSTED',
    label: 'น้ำหนักปรับ (Adjusted BW)',
    hint: 'BMI ≥ 30 ใช้ IBW + 0.25 × (จริง − IBW) ถ้าไม่ถึงใช้น้ำหนักจริง',
  },
  {
    value: 'DRY',
    label: 'น้ำหนักแห้ง (Dry Weight)',
    hint: 'ต้องมีคนกรอกน้ำหนักแห้งไว้ในหน้าบันทึกข้อมูลสุขภาพก่อน',
  },
]

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'ชาย' },
  { value: 'FEMALE', label: 'หญิง' },
  { value: 'OTHER', label: 'อื่นๆ' },
]

const OPERATOR_SYMBOL: Record<Operator, string> = {
  LT: '<',
  LTE: '≤',
  GT: '>',
  GTE: '≥',
  EQ: '=',
  NEQ: '≠',
}

/** แปลงเงื่อนไขเป็นประโยคที่อ่านรู้เรื่อง ไม่ใช่ "ฟอกไต = ฟอกไต" */
function describeCondition(condition: Condition): string {
  if (condition.conditionType === 'DIALYSIS') {
    const isDialysis = condition.value === 'true'
    const negated = condition.operator === 'NEQ'
    return isDialysis !== negated ? 'ผู้ป่วยฟอกไต' : 'ผู้ป่วยไม่ฟอกไต'
  }
  if (condition.conditionType === 'COMORBIDITY') {
    return condition.operator === 'NEQ'
      ? `ไม่มีโรคร่วม ${condition.value}`
      : `มีโรคร่วม ${condition.value}`
  }
  if (condition.conditionType === 'GENDER') {
    const label =
      GENDER_OPTIONS.find((option) => option.value === condition.value)?.label ?? condition.value
    return condition.operator === 'NEQ' ? `เพศไม่ใช่${label}` : `เพศ${label}`
  }
  return `${CONDITION_LABELS[condition.conditionType]} ${OPERATOR_SYMBOL[condition.operator]} ${condition.value}`
}

const emptyRule = (): Rule => ({
  id: '',
  name: '',
  description: null,
  priority: 100,
  weightBasis: 'ACTUAL',
  version: 1,
  isActive: true,
  proteinFactor: 0.8,
  conditions: [{ conditionType: 'EGFR', operator: 'LT', value: '30' }],
})

export function RuleManager({
  rules,
  comorbidities,
}: {
  rules: Rule[]
  comorbidities: { code: string; name: string }[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<Rule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<void>, message: string) {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      await action()
      setNotice(message)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function save() {
    if (!draft) return
    const payload = {
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      priority: draft.priority,
      weightBasis: draft.weightBasis,
      proteinFactor: draft.proteinFactor,
      isActive: draft.isActive,
      conditions: draft.conditions,
    }
    await run(
      async () => {
        if (draft.id) {
          await request(`/api/protein-rules/${draft.id}`, {
            method: 'PUT',
            json: payload,
          })
        } else {
          await request('/api/protein-rules', {
            method: 'POST',
            json: payload,
          })
        }
        setDraft(null)
      },
      draft.id ? 'บันทึกกฎแล้ว (เวอร์ชันใหม่)' : 'สร้างกฎแล้ว',
    )
  }

  function updateCondition(index: number, patch: Partial<Condition>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            conditions: current.conditions.map((condition, conditionIndex) =>
              conditionIndex === index ? { ...condition, ...patch } : condition,
            ),
          }
        : current,
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}

      {draft ? (
        <Card
          title={draft.id ? `แก้ไขกฎ: ${draft.name}` : 'สร้างกฎใหม่'}
          description={
            draft.id
              ? 'บันทึกแล้วจะขึ้นเวอร์ชันใหม่ — เป้าหมายที่คำนวณไว้ก่อนหน้าไม่เปลี่ยนตาม'
              : undefined
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="ชื่อกฎ" className="sm:col-span-2">
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="เช่น CKD ระยะ 4-5 ยังไม่ฟอกไต"
                />
              </Field>
              <Field label="ลำดับความสำคัญ" hint="น้อย = ตรวจก่อน">
                <Input
                  type="number"
                  min={1}
                  value={draft.priority}
                  onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
                  className="tabular"
                />
              </Field>
              <Field label="โปรตีน (g/kg/วัน)">
                <Input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="5"
                  value={draft.proteinFactor}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      proteinFactor: Number(event.target.value),
                    })
                  }
                  className="tabular"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">
                เงื่อนไข
                <span className="ml-2 font-normal text-muted">
                  ต้องเป็นจริงครบทุกข้อ กฎถึงจะถูกเลือก
                </span>
              </p>

              {draft.conditions.map((condition, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-3 rounded-lg bg-background p-3"
                >
                  <Field label="ข้อมูล" className="min-w-40 flex-1">
                    <Select
                      value={condition.conditionType}
                      onChange={(event) =>
                        updateCondition(index, {
                          conditionType: event.target.value as ConditionType,
                          value:
                            event.target.value === 'DIALYSIS'
                              ? 'true'
                              : event.target.value === 'GENDER'
                                ? 'MALE'
                                : event.target.value === 'COMORBIDITY'
                                  ? (comorbidities[0]?.code ?? '')
                                  : condition.value,
                          operator: ['DIALYSIS', 'GENDER'].includes(event.target.value)
                            ? 'EQ'
                            : condition.operator,
                        })
                      }
                    >
                      {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="เงื่อนไข" className="w-52">
                    <Select
                      value={condition.operator}
                      onChange={(event) =>
                        updateCondition(index, {
                          operator: event.target.value as Operator,
                        })
                      }
                    >
                      {OPERATORS.filter((operator) =>
                        ['DIALYSIS', 'COMORBIDITY', 'GENDER'].includes(condition.conditionType)
                          ? operator.value === 'EQ' || operator.value === 'NEQ'
                          : true,
                      ).map((operator) => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="ค่า" className="w-44">
                    {condition.conditionType === 'DIALYSIS' ? (
                      <Select
                        value={condition.value}
                        onChange={(event) => updateCondition(index, { value: event.target.value })}
                      >
                        <option value="true">ฟอกไต</option>
                        <option value="false">ไม่ฟอกไต</option>
                      </Select>
                    ) : condition.conditionType === 'GENDER' ? (
                      <Select
                        value={condition.value}
                        onChange={(event) => updateCondition(index, { value: event.target.value })}
                      >
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : condition.conditionType === 'COMORBIDITY' ? (
                      <Select
                        value={condition.value}
                        onChange={(event) => updateCondition(index, { value: event.target.value })}
                      >
                        {comorbidities.map((comorbidity) => (
                          <option key={comorbidity.code} value={comorbidity.code}>
                            {comorbidity.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={condition.value}
                        onChange={(event) => updateCondition(index, { value: event.target.value })}
                        className="tabular"
                      />
                    )}
                  </Field>

                  {draft.conditions.length > 1 ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          conditions: draft.conditions.filter((_, i) => i !== index),
                        })
                      }
                    >
                      ลบ
                    </Button>
                  ) : null}
                </div>
              ))}

              <Button
                variant="secondary"
                className="self-start"
                onClick={() =>
                  setDraft({
                    ...draft,
                    conditions: [
                      ...draft.conditions,
                      { conditionType: 'EGFR', operator: 'LT', value: '60' },
                    ],
                  })
                }
              >
                + เพิ่มเงื่อนไข
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={pending || !draft.name.trim()}>
                บันทึก
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        title={`กฎทั้งหมด (${rules.length})`}
        actions={draft ? null : <Button onClick={() => setDraft(emptyRule())}>+ สร้างกฎ</Button>}
      >
        {rules.length === 0 ? (
          <EmptyState>ยังไม่มีกฎ — สร้างอย่างน้อย 1 ข้อ ระบบถึงจะคำนวณเป้าหมายได้</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div className="min-w-60 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="tabular text-muted">#{rule.priority}</span>
                    {rule.name}
                    <Badge tone="brand">
                      {rule.proteinFactor} g/kg ·{' '}
                      {WEIGHT_BASIS_OPTIONS.find((option) => option.value === rule.weightBasis)
                        ?.label ?? rule.weightBasis}
                    </Badge>
                    <Badge tone={rule.isActive ? 'ok' : 'muted'}>
                      {rule.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                    <span className="text-xs font-normal text-muted">v{rule.version}</span>
                  </p>
                  <ul className="mt-1 text-sm text-muted">
                    {rule.conditions.map((condition, index) => (
                      <li key={index}>{describeCondition(condition)}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setDraft(rule)} disabled={pending}>
                    แก้ไข
                  </Button>
                  {rule.isActive ? (
                    <Button
                      variant="danger"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            request(`/api/protein-rules/${rule.id}`, {
                              method: 'DELETE',
                            }).then(() => undefined),
                          'ปิดใช้งานกฎแล้ว',
                        )
                      }
                    >
                      ปิดใช้งาน
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
