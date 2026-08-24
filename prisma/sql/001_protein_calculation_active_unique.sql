-- ตาข่ายชั้นสอง: ห้ามมี ProteinCalculation ที่ยัง active (effectiveTo IS NULL) เกินหนึ่งแถวต่อผู้ป่วย
--
-- วิธีใช้:
--   npx prisma migrate dev --create-only --name protein_calculation_active_unique
--   แล้วเอา SQL ข้างล่างไปวางในไฟล์ migration.sql ที่เพิ่งถูกสร้าง (Prisma DSL เขียน partial index ไม่ได้)
--
-- ⚠️ MySQL ไม่มี partial index — ตอนย้าย provider ให้ลบไฟล์นี้ทิ้ง แล้วใช้
--    generated column isActive + UNIQUE (patientId, isActive) แทน
--    แนวป้องกันหลักคือ transaction + SELECT ... FOR UPDATE ที่
--    src/lib/protein/calculation-service.ts ซึ่งใช้ได้กับทั้งสอง provider อยู่แล้ว

CREATE UNIQUE INDEX "protein_calculation_active_unique"
ON "ProteinCalculation" ("patientId")
WHERE "effectiveTo" IS NULL;
