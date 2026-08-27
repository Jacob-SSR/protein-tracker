-- เก็บขนาดจริงของรูปบทความ
-- ไม่มีขนาด = ต้องเดาสัดส่วนแล้วครอป มีขนาดแล้วแสดงเต็มรูปตามสัดส่วนจริงได้
-- รูปเก่าที่อัปโหลดไว้ก่อนหน้าจะเป็น null ระบบมีทางถอยให้อยู่แล้ว

ALTER TABLE "Knowledge"
  ADD COLUMN "imageWidth"  INTEGER,
  ADD COLUMN "imageHeight" INTEGER;
