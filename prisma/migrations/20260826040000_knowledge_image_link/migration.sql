-- บทความแนบรูป (Cloudinary) และลิงก์เว็บไซต์ได้
-- imageUrl เก็บ secure_url, imagePublicId ไว้ลบไฟล์ทีหลัง
-- linkUrl คือลิงก์ปลายทางตอนกดที่รูป ไม่ใช่ลิงก์ไฟล์รูปบน Cloudinary

ALTER TABLE "Knowledge"
  ADD COLUMN "imageUrl"      TEXT,
  ADD COLUMN "imagePublicId" TEXT,
  ADD COLUMN "linkUrl"       TEXT,
  ADD COLUMN "linkLabel"     TEXT;
