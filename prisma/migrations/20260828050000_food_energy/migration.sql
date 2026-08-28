-- พลังงาน (kcal) ต่อหน่วยอาหาร + snapshot ในรายการที่บันทึกไปแล้ว
-- ทั้งคู่เป็น nullable: อาหารเดิมในระบบยังไม่มีข้อมูลพลังงาน และรายการที่บันทึกไปแล้วก็ไม่ย้อนไปเดาให้
ALTER TABLE "FoodUnit" ADD COLUMN "energyKcal" DECIMAL(8,2);
ALTER TABLE "MealItem" ADD COLUMN "energyKcal" DECIMAL(8,2);
