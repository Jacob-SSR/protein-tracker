CREATE UNIQUE INDEX "protein_calculation_active_unique"
ON "ProteinCalculation" ("patientId")
WHERE "effectiveTo" IS NULL;
