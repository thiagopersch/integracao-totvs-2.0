-- CreateEnum
CREATE TYPE "BackupRestoreStatus" AS ENUM ('NOT_RESTORED', 'RESTORED', 'ERROR');

-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "restore_status" "BackupRestoreStatus" NOT NULL DEFAULT 'NOT_RESTORED',
ADD COLUMN     "restored_at" TIMESTAMP(3),
ADD COLUMN     "restored_by_user_id" TEXT,
ADD COLUMN     "restored_to_tbc_id" TEXT,
ADD COLUMN     "totvs_updated_at" TIMESTAMP(3),
ADD COLUMN     "totvs_updated_by" TEXT;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_restored_by_user_id_fkey" FOREIGN KEY ("restored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_restored_to_tbc_id_fkey" FOREIGN KEY ("restored_to_tbc_id") REFERENCES "tbcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
