-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "sentence_category_id" TEXT;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_sentence_category_id_fkey" FOREIGN KEY ("sentence_category_id") REFERENCES "sentence_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
