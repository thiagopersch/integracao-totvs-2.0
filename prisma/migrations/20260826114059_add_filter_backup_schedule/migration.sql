-- CreateEnum
CREATE TYPE "BackupSchedule" AS ENUM ('NONE', 'EVERY_3H', 'EVERY_6H', 'EVERY_12H', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "filters" ADD COLUMN     "next_run_at" TIMESTAMP(3),
ADD COLUMN     "schedule" "BackupSchedule" NOT NULL DEFAULT 'NONE';
