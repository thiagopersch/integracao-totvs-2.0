/*
  Warnings:

  - Made the column `cod_coligada_sentenca` on table `filters` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cod_sistema_sentenca` on table `filters` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BackupRunStatus" AS ENUM ('RUNNING', 'ERROR', 'DONE');

-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "backup_run_id" TEXT,
ADD COLUMN     "cod_coligada" TEXT,
ADD COLUMN     "hash" TEXT,
ADD COLUMN     "is_latest" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing NULLs before enforcing NOT NULL below
UPDATE "filters" SET "cod_coligada_sentenca" = '' WHERE "cod_coligada_sentenca" IS NULL;
UPDATE "filters" SET "cod_sistema_sentenca" = '' WHERE "cod_sistema_sentenca" IS NULL;

-- AlterTable
ALTER TABLE "filters" ADD COLUMN     "last_backup_at" TIMESTAMP(3),
ADD COLUMN     "last_backup_by_user_id" TEXT,
ADD COLUMN     "last_backup_status" "BackupRunStatus",
ALTER COLUMN "cod_coligada_sentenca" SET NOT NULL,
ALTER COLUMN "cod_sistema_sentenca" SET NOT NULL;

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "filter_id" TEXT NOT NULL,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'RUNNING',
    "error_message" TEXT,
    "executed_by_user_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "filters" ADD CONSTRAINT "filters_last_backup_by_user_id_fkey" FOREIGN KEY ("last_backup_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_filter_id_fkey" FOREIGN KEY ("filter_id") REFERENCES "filters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_executed_by_user_id_fkey" FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_backup_run_id_fkey" FOREIGN KEY ("backup_run_id") REFERENCES "backup_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
