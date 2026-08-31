-- โปรตีนตามแนวทางเป็น "ช่วง" ไม่ใช่ตัวเลขเดียว
-- คอลัมน์เดิม proteinFactor / proteinTargetGrams กลายเป็นขอบบนของช่วง (เพดานที่ใช้เตือนเวลาทานเกิน)
-- แถวเก่ายังไม่มีขอบล่าง จึงเป็น null ได้ — ระบบจะแสดงเป็นค่าเดี่ยวเหมือนเดิม
ALTER TABLE "ProteinCalculation" ADD COLUMN "proteinFactorMin" DECIMAL(5,3);
ALTER TABLE "ProteinCalculation" ADD COLUMN "proteinTargetGramsMin" DECIMAL(7,2);
ALTER TABLE "ProteinCalculation" ADD COLUMN "guidelineGroup" TEXT;
