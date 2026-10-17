-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- AlterEnum
ALTER TYPE "MessageTemplateEvent" ADD VALUE 'DEMAND_REPORT';

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "attachments" JSONB;

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL DEFAULT 'ANTHROPIC',
    "model" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_report_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'currentMonth',
    "client_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "to_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "send_to_client_email" BOOLEAN NOT NULL DEFAULT false,
    "schedule" "BackupSchedule" NOT NULL DEFAULT 'NONE',
    "schedule_time" TEXT,
    "day_of_month" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_run_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "demand_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_settings_organization_id_key" ON "ai_settings"("organization_id");

-- CreateIndex
CREATE INDEX "demand_report_schedules_organization_id_deleted_at_idx" ON "demand_report_schedules"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "demand_report_schedules_is_active_next_run_at_idx" ON "demand_report_schedules"("is_active", "next_run_at");

-- AddForeignKey
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_report_schedules" ADD CONSTRAINT "demand_report_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_report_schedules" ADD CONSTRAINT "demand_report_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
