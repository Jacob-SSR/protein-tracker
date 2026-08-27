import 'dotenv/config'
import { PrismaClient, type SettingValueType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

/**
 * Seed เฉพาะข้อมูลตั้งต้นที่ระบบต้องมีเพื่อทำงานได้ (idempotent — รันซ้ำได้)
 * ไม่มี demo/dummy patient เพราะระบบนี้ขึ้น production จริงตั้งแต่แรก
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
})

const SETTINGS: {
  key: string
  value: string
  valueType: SettingValueType
  description: string
}[] = [
  {
    key: 'meal_backdate_days',
    value: '-1',
    valueType: 'INT',
    description: 'บันทึกอาหารย้อนหลังได้กี่วัน (-1 = ไม่จำกัด, 0 = วันนี้เท่านั้น)',
  },
  {
    key: 'meal_future_days',
    value: '0',
    valueType: 'INT',
    description: 'บันทึกอาหารล่วงหน้าได้กี่วัน (0 = ห้ามล่วงหน้า)',
  },
  {
    key: 'patient_portal_enabled',
    value: 'false',
    valueType: 'BOOLEAN',
    description: 'เปิดให้ผู้ป่วยล็อกอินเข้าดูข้อมูลและบันทึกอาหารเองได้',
  },
  {
    key: 'notify_thresholds',
    value: JSON.stringify([
      {
        percent: 80,
        level: 'INFO',
        message: 'ทานโปรตีนถึง 80% ของเป้าหมายแล้ว',
      },
      {
        percent: 90,
        level: 'WARN',
        message: 'ใกล้ถึงเป้าหมายแล้ว เหลืออีกนิดเดียว',
      },
      {
        percent: 100,
        level: 'WARN',
        message: 'ถึงเป้าหมายโปรตีนของวันนี้แล้ว',
      },
      {
        percent: 110,
        level: 'DANGER',
        message: 'เกินเป้าหมายแล้ว ควรงดโปรตีนเพิ่ม',
      },
    ]),
    valueType: 'JSON',
    description: 'เกณฑ์แจ้งเตือน % ของเป้าหมายโปรตีนรายวัน',
  },
]

// โรคประจำร่วมตามแบบฟอร์มที่ใช้จริงในคลินิก
const WATER_SETTINGS = [
  {
    key: 'water_glass_size_ml',
    value: '250',
    valueType: 'INT' as const,
    description: 'ปริมาณน้ำต่อ 1 แก้ว (มล.)',
  },
  {
    key: 'water_ml_per_kg',
    value: '30',
    valueType: 'INT' as const,
    description: 'น้ำที่ควรดื่มต่อน้ำหนักตัว 1 กก. ต่อวัน (มล.) — ใช้กับผู้ป่วยที่ไม่ต้องจำกัดน้ำ',
  },
  {
    key: 'water_reminder_hour',
    value: '20',
    valueType: 'INT' as const,
    description: 'เริ่มเตือนว่ายังดื่มน้ำไม่ครบตั้งแต่กี่โมง (0-23) — ค่าเริ่มต้น 20 น.',
  },
  {
    key: 'water_restricted_max_ml',
    value: '1000',
    valueType: 'INT' as const,
    description: 'เพดานน้ำต่อวันเมื่อต้องจำกัดน้ำ (มล.) — ใช้เมื่อมีภาวะบวม ระยะ 4-5 หรือฟอกไต',
  },
]

const COMORBIDITIES = [
  { code: 'DM', name: 'โรคเบาหวาน' },
  { code: 'HT', name: 'โรคความดันโลหิตสูง' },
  { code: 'OBESITY', name: 'โรคอ้วน' },
  { code: 'PKD', name: 'โรคถุงน้ำที่ไต' },
  { code: 'AUTOIMMUNE', name: 'โรคแพ้ภูมิตัวเอง' },
  { code: 'NEPHRITIS', name: 'โรคไตอักเสบ' },
  { code: 'NEPHROTIC', name: 'กลุ่มโรคไตเนโฟรติก' },
  { code: 'OTHER', name: 'โรคอื่นๆ' },
]

async function main() {
  const username = process.env.SEED_SUPER_ADMIN_USERNAME ?? 'superadmin'
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD

  if (!password || password.length < 8) {
    throw new Error('ต้องตั้ง SEED_SUPER_ADMIN_PASSWORD (อย่างน้อย 8 ตัวอักษร) ก่อนรัน seed')
  }

  const superAdmin = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      fullName: 'System Super Admin',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'SUPER_ADMIN',
    },
    update: {},
  })

  for (const setting of [...SETTINGS, ...WATER_SETTINGS]) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      create: { ...setting, updatedById: superAdmin.id },
      update: { description: setting.description },
    })
  }

  for (const comorbidity of COMORBIDITIES) {
    await prisma.comorbidity.upsert({
      where: { code: comorbidity.code },
      create: comorbidity,
      update: { name: comorbidity.name },
    })
  }

  // กฎตั้งต้นตามแนวทาง CKD ทั่วไป — โรงพยาบาลปรับ/เพิ่มเองได้ทั้งหมดผ่านหน้า admin
  const existingRules = await prisma.proteinRule.count()
  if (existingRules === 0) {
    await prisma.proteinRule.create({
      data: {
        name: 'ผู้ป่วยฟอกไต',
        description: 'ผู้ป่วยที่ฟอกไตต้องการโปรตีนสูงกว่าปกติ',
        priority: 10,
        createdById: superAdmin.id,
        conditions: {
          create: [
            {
              conditionType: 'DIALYSIS',
              operator: 'EQ',
              value: 'true',
              proteinFactor: 1.2,
              sortOrder: 0,
            },
          ],
        },
      },
    })
    await prisma.proteinRule.create({
      data: {
        name: 'CKD ระยะ 4-5 (eGFR < 30) ยังไม่ฟอกไต',
        priority: 20,
        createdById: superAdmin.id,
        conditions: {
          create: [
            {
              conditionType: 'EGFR',
              operator: 'LT',
              value: '30',
              proteinFactor: 0.6,
              sortOrder: 0,
            },
            {
              conditionType: 'DIALYSIS',
              operator: 'EQ',
              value: 'false',
              proteinFactor: 0.6,
              sortOrder: 1,
            },
          ],
        },
      },
    })
    await prisma.proteinRule.create({
      data: {
        name: 'CKD ระยะ 3 (eGFR 30-59)',
        priority: 30,
        createdById: superAdmin.id,
        conditions: {
          create: [
            {
              conditionType: 'EGFR',
              operator: 'LT',
              value: '60',
              proteinFactor: 0.8,
              sortOrder: 0,
            },
          ],
        },
      },
    })
    await prisma.proteinRule.create({
      data: {
        name: 'ค่าเริ่มต้น (ไตทำงานปกติ)',
        description: 'กฎสำรองท้ายสุด ใช้เมื่อไม่มีกฎไหนตรง',
        priority: 900,
        createdById: superAdmin.id,
        conditions: {
          create: [
            {
              conditionType: 'WEIGHT',
              operator: 'GT',
              value: '0',
              proteinFactor: 1.0,
              sortOrder: 0,
            },
          ],
        },
      },
    })
  }

  console.log(`seed เสร็จแล้ว — super admin: ${superAdmin.username}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
