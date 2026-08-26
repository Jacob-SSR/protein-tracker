-- รหัสเชิญให้ผู้ป่วยไปตั้งบัญชีเอง
-- เก็บเฉพาะ sha256 ของรหัส — รหัสจริงไม่เคยถูกเขียนลงฐานข้อมูล
-- ใช้ได้ครั้งเดียว มีวันหมดอายุ และเจ้าหน้าที่ยกเลิกได้ทุกเมื่อ

CREATE TABLE "PatientInvite" (
  "id"           TEXT NOT NULL,
  "patientId"    TEXT NOT NULL,
  "codeHash"     TEXT NOT NULL,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "usedAt"       TIMESTAMP(3),
  "usedByUserId" TEXT,
  "revokedAt"    TIMESTAMP(3),
  "createdById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientInvite_codeHash_key" ON "PatientInvite"("codeHash");
CREATE INDEX "PatientInvite_patientId_createdAt_idx" ON "PatientInvite"("patientId", "createdAt");

ALTER TABLE "PatientInvite" ADD CONSTRAINT "PatientInvite_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientInvite" ADD CONSTRAINT "PatientInvite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
