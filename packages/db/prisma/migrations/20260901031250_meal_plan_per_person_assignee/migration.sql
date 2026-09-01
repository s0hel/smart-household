-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN     "assigneeId" TEXT;

-- DropIndex
DROP INDEX "MealPlanEntry_householdId_date_mealType_key";

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanEntry_householdId_date_mealType_assigneeId_key" ON "MealPlanEntry"("householdId", "date", "mealType", "assigneeId");

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
