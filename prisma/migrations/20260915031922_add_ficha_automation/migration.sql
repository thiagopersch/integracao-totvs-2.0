-- CreateEnum
CREATE TYPE "FichaAutomationStatus" AS ENUM ('RUNNING', 'DONE', 'ERROR', 'PARTIAL');

-- CreateEnum
CREATE TYPE "FichaAutomationStepStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'SKIPPED');

-- CreateTable
CREATE TABLE "ficha_automation_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "id_ps" TEXT NOT NULL,
    "page_url" TEXT NOT NULL,
    "status" "FichaAutomationStatus" NOT NULL DEFAULT 'RUNNING',
    "final_submit_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "ficha_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ficha_automation_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "etapa_nome" TEXT NOT NULL,
    "passo_nome" TEXT,
    "kind" TEXT NOT NULL,
    "status" "FichaAutomationStepStatus" NOT NULL DEFAULT 'PENDING',
    "duration_ms" INTEGER,
    "fields_filled" INTEGER,
    "fields_failed" INTEGER,
    "error_message" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ficha_automation_steps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ficha_automation_runs" ADD CONSTRAINT "ficha_automation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_automation_runs" ADD CONSTRAINT "ficha_automation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_automation_steps" ADD CONSTRAINT "ficha_automation_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ficha_automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
