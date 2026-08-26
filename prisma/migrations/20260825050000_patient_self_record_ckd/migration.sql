-- ผู้ป่วยบันทึกข้อมูลตัวเองได้ + คำนวณระยะโรคไต
--   1. บันทึกรายวันเพิ่ม: น้ำหนักแห้ง, ภาวะบวม, ปริมาณน้ำที่ดื่ม
--   2. ฐานน้ำหนักเพิ่มตัวเลือก DRY (น้ำหนักแห้ง)
--   3. เป้าหมายเก็บพลังงาน (kcal) + ระยะไต/eGFR ณ ตอนยืนยันไว้ด้วย
-- คอลัมน์ใหม่ nullable ทั้งหมด ข้อมูลเดิมจึงไม่ต้อง backfill

-- PostgreSQL 12+ ยอมให้ ADD VALUE ใน transaction ได้ ตราบใดที่ไม่ใช้ค่าใหม่ใน transaction เดียวกัน
-- migration นี้ไม่มีที่ไหนอ้าง 'DRY' จึงปลอดภัย
ALTER TYPE "WeightBasis" ADD VALUE 'DRY';

ALTER TABLE "PatientMeasurement"
  ADD COLUMN "dryWeightKg"   DECIMAL(6,2),
  ADD COLUMN "hasEdema"      BOOLEAN,
  ADD COLUMN "waterIntakeMl" INTEGER;

ALTER TABLE "ProteinCalculation"
  ADD COLUMN "energyFactorKcal" INTEGER,
  ADD COLUMN "energyTargetKcal" DECIMAL(8,2),
  ADD COLUMN "ckdStageCode"     TEXT,
  ADD COLUMN "egfr"             DECIMAL(6,2);
