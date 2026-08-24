-- ผู้ป่วยไม่จำเป็นต้องมีบัญชีเข้าระบบอีกต่อไป
--   1. ชื่อผู้ป่วยย้ายมาอยู่ที่ Patient.fullName (เดิมอ่านผ่าน User.fullName)
--   2. Patient.userId เป็น optional — มีค่าเฉพาะผู้ป่วยที่เปิดสิทธิ์เข้าระบบเองแล้ว
-- เพิ่มคอลัมน์แบบ nullable ก่อน แล้ว backfill จากบัญชีเดิม ค่อยบังคับ NOT NULL
-- ข้อมูลผู้ป่วยที่มีอยู่จึงไม่หาย

ALTER TABLE "Patient" ADD COLUMN "fullName" TEXT;

UPDATE "Patient" AS p
SET "fullName" = u."fullName"
FROM "User" AS u
WHERE u."id" = p."userId" AND p."fullName" IS NULL;

-- เผื่อกรณีที่หาบัญชีต้นทางไม่เจอ ใส่ HN ไปก่อน แล้วให้แอดมินแก้ชื่อทีหลัง
UPDATE "Patient" SET "fullName" = CONCAT('ผู้ป่วย HN ', "hn") WHERE "fullName" IS NULL;

ALTER TABLE "Patient" ALTER COLUMN "fullName" SET NOT NULL;

-- ลบบัญชีผู้ใช้ทิ้งไม่ให้ลบประวัติผู้ป่วยตามไปด้วยอีกต่อไป
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_userId_fkey";
ALTER TABLE "Patient" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
