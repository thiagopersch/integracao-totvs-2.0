-- AlterTable
ALTER TABLE "filters" ADD COLUMN     "schedule_time" TEXT,
ADD COLUMN     "schedule_category_id" TEXT;

-- AddForeignKey
ALTER TABLE "filters" ADD CONSTRAINT "filters_schedule_category_id_fkey" FOREIGN KEY ("schedule_category_id") REFERENCES "sentence_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
