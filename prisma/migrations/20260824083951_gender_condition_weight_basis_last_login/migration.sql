-- CreateEnum
CREATE TYPE "WeightBasis" AS ENUM ('ACTUAL', 'IBW', 'ADJUSTED');

-- AlterEnum
ALTER TYPE "ConditionType" ADD VALUE 'GENDER';

-- AlterTable
ALTER TABLE "ProteinCalculation" ADD COLUMN     "weightBasis" "WeightBasis" NOT NULL DEFAULT 'ACTUAL';

-- AlterTable
ALTER TABLE "ProteinRule" ADD COLUMN     "weightBasis" "WeightBasis" NOT NULL DEFAULT 'ACTUAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
