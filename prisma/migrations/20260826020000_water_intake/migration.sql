-- น้ำดื่ม: บันทึกทีละแก้ว + เป้าหมายน้ำต่อวันบนผลการคำนวณ
-- PatientMeasurement.waterIntakeMl เลิกใช้แล้วแต่ไม่ลบทิ้ง ข้อมูลเก่ายังอยู่ครบ

CREATE TABLE "WaterIntakeEntry" (
  "id"          TEXT NOT NULL,
  "patientId"   TEXT NOT NULL,
  "intakeDate"  DATE NOT NULL,
  "amountMl"    INTEGER NOT NULL,
  "clientToken" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WaterIntakeEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaterIntakeEntry_clientToken_key" ON "WaterIntakeEntry"("clientToken");
CREATE INDEX "WaterIntakeEntry_patientId_intakeDate_idx" ON "WaterIntakeEntry"("patientId", "intakeDate");

ALTER TABLE "WaterIntakeEntry" ADD CONSTRAINT "WaterIntakeEntry_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterIntakeEntry" ADD CONSTRAINT "WaterIntakeEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProteinCalculation" ADD COLUMN "waterTargetMl" INTEGER;
