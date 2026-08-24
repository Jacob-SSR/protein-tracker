# Protein Tracker

ระบบติดตามการบริโภคโปรตีนสำหรับผู้ป่วยโรคไต (CKD) — Next.js 16 (App Router) + Prisma 7 + PostgreSQL (Supabase)

## ใครใช้ระบบนี้

ตอนนี้เป็น **ระบบของเจ้าหน้าที่** — ผู้ป่วยไม่ต้องสมัคร ไม่ต้องมีบัญชี
เจ้าหน้าที่เป็นคนเพิ่มผู้ป่วย บันทึกน้ำหนัก/ผลเลือด คำนวณเป้าหมาย และบันทึกอาหารให้

ส่วนของผู้ป่วยมีอยู่ครบแล้วแต่ **ปิดไว้** เปิดได้ทีหลังโดยไม่ต้องแก้โค้ด:

1. เปิดสวิตช์ "ส่วนของผู้ป่วย" ที่ `/admin/settings` (`patient_portal_enabled`)
2. เข้าหน้าผู้ป่วยรายคน แล้วกด "เปิดสิทธิ์" ตั้งชื่อผู้ใช้/รหัสผ่านให้เป็นรายคน

ปิดสวิตช์เมื่อไหร่ บัญชีผู้ป่วยล็อกอินไม่ได้ทันที แต่ข้อมูลและประวัติทั้งหมดยังอยู่ครบ
`Patient.userId` เป็น optional — ผู้ป่วยส่วนใหญ่จะไม่มีบัญชีผูกอยู่เลย

## หลักการที่โค้ดนี้ยึด

ทุกอย่างที่มีผลต่อข้อมูลย้อนหลังต้อง **snapshot / version** ไม่ overwrite ค่าเดิมทิ้ง

| ของ | เก็บประวัติยังไง |
|---|---|
| น้ำหนัก / ส่วนสูง | `PatientMeasurement` เพิ่มแถวใหม่ทุกครั้ง |
| ผลเลือด | `PatientLab` เพิ่มแถวใหม่ทุกครั้ง |
| เป้าหมายโปรตีน | `ProteinCalculation` ปิดแถวเก่าด้วย `effectiveTo` + สร้างแถวใหม่ พร้อม `inputSnapshot` |
| โปรตีนที่กิน | `MealItem.proteinAmount` เป็น snapshot ไม่คำนวณสดจาก `Food` |
| แก้/ลบอาหาร | `MealItemHistory` ทุก CREATE/UPDATE/DELETE (MealItem เป็น hard delete) |
| ทุก mutation สำคัญ | `AuditLog` (append-only ไม่มี API ลบ/แก้) |

## Business rules ที่ lock แล้ว

- **บันทึกย้อนหลัง** คุมด้วย `SystemSetting.meal_backdate_days` (`-1` = ไม่จำกัด, `0` = วันนี้เท่านั้น, `n` = ย้อนหลัง n วัน) ตรวจที่ service layer — `src/lib/meals/service.ts` ไม่ใช่ DB constraint จึงปรับได้โดยไม่ต้อง redeploy
- **แก้/ลบอาหาร** insert `MealItemHistory` เสมอ พร้อม `oldValue`/`newValue` เป็น JSON snapshot เต็ม แล้วคำนวณยอดรวมของวันนั้นใหม่ทันที
- **เป้าหมายโปรตีน** เปลี่ยนแล้วมีผล **วันถัดไปเสมอ** — `effectiveFrom`/`effectiveTo` เป็น `@db.Date` ไม่มี time component จึงไม่มีวันไหนที่มีสอง target ซ้อนกัน
- **Preview แยกจาก Confirm คนละ endpoint** — `POST .../protein-target/preview` ไม่เขียน DB เด็ดขาด

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env          # ใส่ DATABASE_URL / DIRECT_URL / JWT_SECRET
npm run db:migrate            # สร้างตารางครั้งแรก
npm run db:seed               # super admin + comorbidity + system setting + กฎตั้งต้น
npm run dev
```

> `JWT_SECRET` ต้องยาวอย่างน้อย 32 ตัวอักษร (`openssl rand -base64 48`)
> บน Vercel ตั้งค่าใน Environment Variables ห้าม commit `.env`

### อัปเดตจากเวอร์ชันก่อนหน้า

migration `patient_without_account` ย้ายชื่อผู้ป่วยจาก `User.fullName` มาไว้ที่ `Patient.fullName`
และทำให้ `Patient.userId` เป็น optional — ตัว migration **backfill ชื่อจากบัญชีเดิมให้อัตโนมัติ**
ข้อมูลผู้ป่วยที่มีอยู่จึงไม่หาย ส่วน migration ก่อนหน้าเป็นแบบเพิ่มอย่างเดียว รันได้เลย:

```bash
npm run db:deploy
```

> ใช้ `db:deploy` เท่านั้นกับ Supabase — `db:migrate` (migrate dev) ต้องสร้าง shadow database
> ซึ่ง Supabase ไม่ให้สิทธิ์ และจะสร้างไฟล์ migration ใหม่มาชนกับของเดิม

### เจอ error `Unknown field ... for select statement`

แปลว่า Prisma Client ที่ generate ไว้เก่ากว่า `schema.prisma` (เกิดตอนดึงโค้ดใหม่มาแล้วไม่ได้ `npm install`)
แก้ตามลำดับนี้ — **ห้ามสลับลำดับ** เพราะถ้า generate ก่อน deploy จะไปพังที่ระดับฐานข้อมูลแทน

```bash
npm run db:deploy    # 1. เพิ่มคอลัมน์ใหม่ลง DB ก่อน
npx prisma generate  # 2. แล้วค่อย generate client ให้ตรง schema
npm run dev          # 3. รีสตาร์ท (Turbopack cache client ตัวเก่าไว้)
```

ตอนนี้ script `dev` รัน `prisma generate` ให้อัตโนมัติทุกครั้งอยู่แล้ว ปัญหานี้จึงไม่ควรเกิดซ้ำ

### Partial unique index (Postgres)

หลัง migrate ครั้งแรก ให้เพิ่ม index ตาม `prisma/sql/001_protein_calculation_active_unique.sql`:

```bash
npx prisma migrate dev --create-only --name protein_calculation_active_unique
# วาง SQL จากไฟล์ข้างบนลงใน migration.sql ที่ถูกสร้าง แล้ว
npx prisma migrate dev
```

เป็นแค่ **ตาข่ายชั้นสอง** — แนวป้องกันหลักคือ transaction + `SELECT ... FOR UPDATE`
ใน `src/lib/protein/calculation-service.ts` ซึ่งใช้ได้ทั้ง Postgres และ MySQL

## โครงสร้าง

```
prisma/
├── schema.prisma            # models ทั้งหมด
├── seed.ts                  # ข้อมูลตั้งต้น (idempotent)
└── sql/                     # SQL ที่ Prisma DSL เขียนไม่ได้
src/
├── app/
│   ├── (auth)/login/
│   ├── admin/               # patients, patients/[id], foods, settings
│   ├── patient/             # dashboard, meals, weekly
│   └── api/                 # auth, patients, foods, meals, summary, settings, audit-logs
├── components/              # client components
├── lib/
│   ├── api.ts               # response format + requireSession
│   ├── audit.ts date.ts decimal.ts errors.ts settings.ts
│   ├── auth/                # jwt.ts password.ts session.ts guards.ts
│   ├── db/prisma.ts
│   ├── meals/               # service.ts (mutation + history) summary.ts
│   ├── patients/access.ts
│   ├── permissions/         # authorization ล้วน ไม่มี business logic
│   └── protein/             # rules.ts calculator.ts calculation-service.ts
└── proxy.ts                 # Next.js 16 เรียก middleware ว่า proxy
```

แยก 3 concern ชัดเจน ห้ามปนกัน:

1. **Authentication** — `lib/auth/` (JWT → userId)
2. **Authorization** — `lib/permissions/`, `lib/patients/access.ts`
3. **Business logic** — `lib/protein/`, `lib/meals/`

`src/proxy.ts` เป็นแค่ optimistic redirect เพื่อ UX — **ทุก** route handler เรียก `requireSession()` เอง
และทุกหน้า admin/patient เรียก `requireAdminPage()` / `requirePatientPage()` เอง

## หน้าจอ

**ฝั่งผู้ป่วย** (`/patient`) — เข้าได้เมื่อเปิดสวิตช์ "ส่วนของผู้ป่วย" เท่านั้น

| หน้า | ทำอะไรได้ |
|---|---|
| วันนี้ | เป้าหมาย / ทานแล้ว / เหลือ พร้อมแถบความคืบหน้าและข้อความแจ้งเตือนตามเกณฑ์ |
| บันทึกอาหาร | เลือกวัน+มื้อ ค้นหาอาหาร เลือกหน่วย ใส่จำนวน เห็นโปรตีนที่จะได้ก่อนกดเพิ่ม เตือนโควต้าทันทีหลังบันทึก แก้/ลบรายการได้ |
| รายสัปดาห์ | คำตัดสินว่าทานเหมาะสมหรือไม่ + ตารางเทียบเป้าหมายกับที่ทานจริงรายวัน |
| เสนออาหารใหม่ | ส่งอาหารที่ไม่มีในระบบให้แอดมินตรวจ พร้อมดูสถานะที่เคยเสนอ |
| ความรู้ | อ่านบทความเวอร์ชันที่เผยแพร่ |

**ฝั่งผู้ดูแล** (`/admin`)

| หน้า | ทำอะไรได้ |
|---|---|
| ผู้ป่วย | รายชื่อ + เพิ่มผู้ป่วยใหม่ (ไม่ต้องมีบัญชี) |
| ผู้ป่วย → รายคน | **บันทึกอาหารแทนผู้ป่วย**, บันทึกน้ำหนัก/ผลเลือด/โรคร่วม, Preview → Confirm เป้าหมาย, เปิด/ปิดสิทธิ์เข้าระบบ, ดูประวัติทั้งหมด |
| อาหาร | อนุมัติ/ไม่อนุมัติรายการที่ผู้ป่วยเสนอ, เพิ่ม/แก้อาหารและหน่วย, เก็บเข้าคลัง |
| กฎโปรตีน | สร้าง/แก้/ปิดใช้งานกฎและเงื่อนไข (แก้แล้วขึ้นเวอร์ชันใหม่) |
| บทความ | เขียน/แก้บทความ แก้แล้วได้เวอร์ชันใหม่ เลือกเผยแพร่ทีละเวอร์ชัน |
| ผู้ใช้ | สร้างบัญชี**เจ้าหน้าที่**, รีเซ็ตรหัสผ่าน, ปิด-เปิดใช้งาน, ดูเวลาเข้าใช้ล่าสุด |
| ตั้งค่า | ปรับ backdate / ล่วงหน้า / เกณฑ์แจ้งเตือน ผ่านฟอร์ม ไม่ต้องแตะ JSON |
| Audit Log | อ่านอย่างเดียว เฉพาะ SUPER_ADMIN |

## API

| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/auth/login` `/api/auth/logout` | ทุกคน |
| GET | `/api/auth/me` | ล็อกอินแล้ว |
| GET/POST | `/api/patients` | admin (POST = เพิ่มผู้ป่วยโดยไม่ต้องมีบัญชี) |
| POST/DELETE | `/api/patients/[id]/account` | admin — เปิด/ปิดสิทธิ์เข้าระบบของผู้ป่วย |
| GET | `/api/patients/[id]` | admin หรือเจ้าของ |
| POST | `/api/patients/[id]/measurements` `/labs` | admin |
| PUT | `/api/patients/[id]/comorbidities` | admin |
| GET | `/api/patients/[id]/protein-target?date=` | admin หรือเจ้าของ |
| POST | `/api/patients/[id]/protein-target/preview` | admin (ไม่เขียน DB) |
| POST | `/api/patients/[id]/protein-target/confirm` | admin |
| GET/POST | `/api/users` | admin — บัญชีเจ้าหน้าที่เท่านั้น (สร้างระดับ admin ต้อง SUPER_ADMIN) |
| PATCH | `/api/users/[id]` · PUT `/api/users/[id]/password` | admin |
| GET/POST | `/api/foods` | ผู้ป่วยเห็นเฉพาะ ACTIVE / เสนอใหม่ได้เป็น PENDING |
| GET/PATCH | `/api/foods/[id]` | admin |
| POST | `/api/foods/[id]/approve` `/reject` | admin |
| GET/POST | `/api/protein-rules` · PUT/DELETE `/api/protein-rules/[id]` | admin |
| GET/POST | `/api/comorbidities` | admin |
| GET/POST | `/api/knowledge` · POST `/api/knowledge/[slug]` | อ่าน: ทุกคน (ผู้ป่วยเห็นเฉพาะที่เผยแพร่) / เขียน: admin |
| GET/POST | `/api/meals` | เจ้าของ (admin ต้องส่ง `patientId`) |
| PATCH/DELETE | `/api/meals/items/[itemId]` | เจ้าของ |
| GET | `/api/summary/weekly` | เจ้าของ |
| GET/PUT | `/api/settings` | admin |
| GET | `/api/audit-logs` | SUPER_ADMIN เท่านั้น |

Response format เดียวกันทั้งหมด: สำเร็จ `{ data: ... }` / ผิดพลาด `{ error: { code, message, details? } }`

## ตั้งค่าระบบ

หน้า `/admin/settings` เป็นฟอร์มล้วน ไม่มีช่องให้กรอก JSON — ค่าที่เก็บจริงยังเป็น key-value ใน `SystemSetting`
แต่ฝั่ง UI แปลงให้เป็นตัวเลือก/ตาราง และฝั่ง server ตรวจโครงสร้างซ้ำที่ `validateKnownSetting()` ใน `src/lib/settings.ts`

| key | ความหมาย |
|---|---|
| `meal_backdate_days` | `-1` ไม่จำกัด · `0` วันนี้เท่านั้น · `n` ย้อนหลัง n วัน |
| `meal_future_days` | บันทึกล่วงหน้าได้กี่วัน (ปกติ `0`) |
| `notify_thresholds` | รายการเกณฑ์ `{percent, level, message}` — แก้ผ่านตารางในหน้าตั้งค่า |
| `patient_portal_enabled` | `false` = ระบบของเจ้าหน้าที่ล้วน · `true` = ผู้ป่วยที่ได้รับสิทธิ์ล็อกอินเองได้ |

## กฎคำนวณโปรตีน

`ProteinRule` + `ProteinRuleCondition` — เงื่อนไขในกฎเดียวกันเป็น **AND ล้วน**,
กฎเรียงตาม `priority` (น้อยมาก่อน) กฎแรกที่ match ทุกเงื่อนไขคือกฎที่ใช้

```
proteinTargetGrams = proteinFactor × น้ำหนักตามฐานที่กฎกำหนด
```

**เงื่อนไขที่ใช้ได้:** เพศ · eGFR · Albumin · BUN · Creatinine · Potassium · Phosphorus ·
BMI · อายุ · น้ำหนัก · ระยะ CKD · โรคร่วม · ฟอกไต

**ฐานน้ำหนัก (`weightBasis`) เลือกได้ต่อกฎ** — สำคัญมากกับผู้ป่วยที่มีน้ำหนักเกิน
เพราะคูณด้วยน้ำหนักจริงจะได้เป้าหมายสูงเกินความเป็นจริง

| ค่า | คูณกับ | ต้องมีข้อมูล |
|---|---|---|
| `ACTUAL` | น้ำหนักที่ชั่งได้ล่าสุด | น้ำหนัก |
| `IBW` | น้ำหนักอุดมคติ สูตร Devine | น้ำหนัก + **ส่วนสูง + เพศ** |
| `ADJUSTED` | BMI ≥ 30 → `IBW + 0.25 × (จริง − IBW)` · ไม่ถึง → น้ำหนักจริง | น้ำหนัก + **ส่วนสูง + เพศ** |

สูตร Devine: ชาย `50 + 2.3 × (ส่วนสูงเป็นนิ้ว − 60)` · หญิง `45.5 + 2.3 × (ส่วนสูงเป็นนิ้ว − 60)`
เพศ `OTHER` หรือไม่ระบุคำนวณไม่ได้ — ถ้ากฎที่ match ใช้ IBW/ADJUSTED แต่ข้อมูลไม่ครบ
ระบบจะไม่เดาให้ แต่จะบอกตรงๆ ว่าต้องกรอกอะไรเพิ่ม แล้วกด Confirm ไม่ได้จนกว่าจะครบ

> กฎตั้งต้นจาก seed ตั้ง `weightBasis = ACTUAL` ไว้ทั้งหมด เพื่อให้ใช้งานได้ทันทีแม้ยังไม่มีส่วนสูง
> โรงพยาบาลควรเปลี่ยนเป็น IBW หรือ ADJUSTED ตามแนวปฏิบัติของตัวเองที่หน้า `/admin/protein-rules`

`ProteinCalculation` เก็บ `weightBasis` + `referenceWeightKg` (น้ำหนักที่คูณจริง) ไว้ด้วย
ผลย้อนหลังจึงอธิบายได้เสมอว่าตัวเลขนั้นมาจากฐานไหน

nested condition / OR ยังไม่ทำ — รอเห็น rule จริงจากโรงพยาบาลก่อน (ดูหัวข้อ "ยังไม่ปิด")

## การเตือนและการประเมิน

- **รายวัน** — ข้อความเตือนขึ้นทั้งหน้า "วันนี้" และ**ทันทีหลังกดบันทึกแต่ละมื้อ**
  ใช้เกณฑ์สูงสุดที่ถึงแล้วจาก `notify_thresholds` พร้อมบอกว่าเหลือ/เกินอีกกี่กรัม
- **รายสัปดาห์** — สรุปเป็นคำตัดสิน (เหมาะสม / เกินบางวัน / เกินบ่อยเกินไป / ทานน้อยเกินไป /
  บันทึกไม่ครบ) ประเมินเฉพาะวันที่ผ่านมาแล้วและมีเป้าหมายกำกับ วันในอนาคตของสัปดาห์ไม่นับ
  เกณฑ์อยู่ที่ `judgeWeek()` ใน `src/lib/meals/summary.ts` แก้ได้ที่เดียว

## PostgreSQL → MySQL (อนาคต)

จุดที่ต้องแตะตอนย้าย:

1. `prisma/schema.prisma` — เปลี่ยน `provider` เป็น `mysql`
2. `src/lib/db/prisma.ts` + `prisma/seed.ts` — เปลี่ยน adapter เป็น `@prisma/adapter-mariadb`
3. ลบ `prisma/sql/001_protein_calculation_active_unique.sql` (MySQL ไม่มี partial index)
   ใช้ generated column `isActive` + `UNIQUE (patientId, isActive)` แทน
4. `lockPatientRow()` ใน `src/lib/protein/calculation-service.ts` — เปลี่ยน quote ชื่อตาราง `"Patient"` เป็น `` `Patient` ``
5. `mode: 'insensitive'` ใน `findMany` (ไฟล์ `api/foods/route.ts`, `api/patients/route.ts`) — MySQL collation
   เป็น case-insensitive อยู่แล้ว ให้ลบ option นี้ทิ้ง

ที่เหลือ (`@db.Date`, `cuid()`, `Json` แบบอ่าน/เขียนทั้งก้อน, transaction + `FOR UPDATE`) ใช้ได้ทั้งสอง provider ไม่ต้องแก้

## ยังไม่ปิด (ตามสเปกหมวด 8)

- `PatientLab.labType` ยังเป็น free string (normalize เป็นตัวพิมพ์ใหญ่ตอนบันทึกแล้ว) — รอ list ผลเลือดจริงก่อนทำ master table `LabType`
- `meal_backdate_days` default `-1` ปรับได้ที่หน้า `/admin/settings`
- `ProteinRuleCondition` รองรับแค่ threshold + AND
- ยังไม่มีหน้าแก้ไข/ลบข้อมูลน้ำหนักและผลเลือดที่บันทึกผิด (ตอนนี้แก้ได้ด้วยการบันทึกแถวใหม่ทับความหมายเดิม)
- ยังไม่ได้จำกัดความถี่การอัปเดตบทความเป็น 1 ครั้ง/เดือน — แก้ได้ไม่จำกัด ถ้าต้องการล็อกจริงต้องเพิ่มเงื่อนไขตอนสร้างเวอร์ชันใหม่
- ยังไม่มี pagination ในหน้า Audit Log (แสดง 200 รายการล่าสุด — API รองรับ cursor แล้ว)
