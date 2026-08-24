-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('EGFR', 'ALBUMIN', 'BUN', 'CREATININE', 'POTASSIUM', 'PHOSPHORUS', 'BMI', 'AGE', 'WEIGHT', 'CKD_STAGE', 'COMORBIDITY', 'DIALYSIS');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('LT', 'LTE', 'GT', 'GTE', 'EQ', 'NEQ');

-- CreateEnum
CREATE TYPE "FoodStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "HistoryAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'INT', 'FLOAT', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hn" TEXT NOT NULL,
    "birthDate" DATE,
    "gender" "Gender",
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientMeasurement" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "measuredOn" DATE NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "heightCm" DECIMAL(5,1),
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientLab" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "labType" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "measuredOn" DATE NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientLab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comorbidity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Comorbidity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientComorbidity" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "comorbidityId" TEXT NOT NULL,
    "diagnosedOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientComorbidity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProteinRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProteinRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProteinRuleCondition" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "conditionType" "ConditionType" NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "proteinFactor" DECIMAL(5,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProteinRuleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProteinCalculation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleVersion" INTEGER,
    "ruleNameSnapshot" TEXT,
    "referenceWeightKg" DECIMAL(6,2) NOT NULL,
    "proteinFactor" DECIMAL(5,3) NOT NULL,
    "proteinTargetGrams" DECIMAL(7,2) NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "note" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProteinCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "status" "FoodStatus" NOT NULL DEFAULT 'PENDING',
    "proposedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodUnit" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "gramsPerUnit" DECIMAL(8,2),
    "proteinAmount" DECIMAL(7,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FoodUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "foodUnitId" TEXT NOT NULL,
    "foodNameSnapshot" TEXT NOT NULL,
    "unitNameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "proteinAmount" DECIMAL(8,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItemHistory" (
    "id" TEXT NOT NULL,
    "mealItemId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "mealDate" DATE NOT NULL,
    "action" "HistoryAction" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "SettingValueType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_hn_key" ON "Patient"("hn");

-- CreateIndex
CREATE INDEX "PatientMeasurement_patientId_measuredOn_idx" ON "PatientMeasurement"("patientId", "measuredOn");

-- CreateIndex
CREATE INDEX "PatientLab_patientId_labType_measuredOn_idx" ON "PatientLab"("patientId", "labType", "measuredOn");

-- CreateIndex
CREATE UNIQUE INDEX "Comorbidity_code_key" ON "Comorbidity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PatientComorbidity_patientId_comorbidityId_key" ON "PatientComorbidity"("patientId", "comorbidityId");

-- CreateIndex
CREATE INDEX "ProteinRule_isActive_priority_idx" ON "ProteinRule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "ProteinRuleCondition_ruleId_sortOrder_idx" ON "ProteinRuleCondition"("ruleId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProteinCalculation_patientId_effectiveFrom_idx" ON "ProteinCalculation"("patientId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ProteinCalculation_patientId_effectiveTo_idx" ON "ProteinCalculation"("patientId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Food_status_name_idx" ON "Food"("status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FoodUnit_foodId_unitName_key" ON "FoodUnit"("foodId", "unitName");

-- CreateIndex
CREATE INDEX "Meal_patientId_mealDate_idx" ON "Meal"("patientId", "mealDate");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_patientId_mealDate_mealType_key" ON "Meal"("patientId", "mealDate", "mealType");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "MealItemHistory_mealItemId_idx" ON "MealItemHistory"("mealItemId");

-- CreateIndex
CREATE INDEX "MealItemHistory_patientId_mealDate_idx" ON "MealItemHistory"("patientId", "mealDate");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Knowledge_slug_isPublished_idx" ON "Knowledge"("slug", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Knowledge_slug_version_key" ON "Knowledge"("slug", "version");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMeasurement" ADD CONSTRAINT "PatientMeasurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMeasurement" ADD CONSTRAINT "PatientMeasurement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientLab" ADD CONSTRAINT "PatientLab_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientLab" ADD CONSTRAINT "PatientLab_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComorbidity" ADD CONSTRAINT "PatientComorbidity_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComorbidity" ADD CONSTRAINT "PatientComorbidity_comorbidityId_fkey" FOREIGN KEY ("comorbidityId") REFERENCES "Comorbidity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProteinRule" ADD CONSTRAINT "ProteinRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProteinRuleCondition" ADD CONSTRAINT "ProteinRuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ProteinRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProteinCalculation" ADD CONSTRAINT "ProteinCalculation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProteinCalculation" ADD CONSTRAINT "ProteinCalculation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodUnit" ADD CONSTRAINT "FoodUnit_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodUnitId_fkey" FOREIGN KEY ("foodUnitId") REFERENCES "FoodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItemHistory" ADD CONSTRAINT "MealItemHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
