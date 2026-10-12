-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomFieldType" ADD VALUE 'CHECKBOX';
ALTER TYPE "CustomFieldType" ADD VALUE 'CHECKBOX_GROUP';
ALTER TYPE "CustomFieldType" ADD VALUE 'DATETIME';
ALTER TYPE "CustomFieldType" ADD VALUE 'TIME';

-- AlterTable
ALTER TABLE "custom_field_definitions" ADD COLUMN     "config" JSONB;

-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "project_task_id" TEXT;

-- AlterTable
ALTER TABLE "project_tasks" ADD COLUMN     "phase_id" TEXT,
ADD COLUMN     "stage_id" TEXT;

-- CreateTable
CREATE TABLE "project_stages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "wip_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_phases" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0ea5e9',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_stages_project_id_deleted_at_position_idx" ON "project_stages"("project_id", "deleted_at", "position");

-- CreateIndex
CREATE INDEX "project_phases_project_id_deleted_at_position_idx" ON "project_phases"("project_id", "deleted_at", "position");

-- CreateIndex
CREATE INDEX "demands_project_id_idx" ON "demands"("project_id");

-- CreateIndex
CREATE INDEX "demands_project_task_id_idx" ON "demands"("project_task_id");

-- CreateIndex
CREATE INDEX "project_tasks_stage_id_idx" ON "project_tasks"("stage_id");

-- CreateIndex
CREATE INDEX "project_tasks_phase_id_idx" ON "project_tasks"("phase_id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_project_task_id_fkey" FOREIGN KEY ("project_task_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "project_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (data only): default workflow stages for existing projects, and each task's stage by its status.
INSERT INTO "project_stages" ("id", "project_id", "name", "color", "position", "category", "created_at", "updated_at")
SELECT gen_random_uuid()::text, p."id", s."name", s."color", s."position", s."category"::"ProjectTaskStatus", NOW(), NOW()
FROM "projects" p
CROSS JOIN (VALUES
  ('Backlog', '#94a3b8', 1024, 'BACKLOG'),
  ('A fazer', '#8b5cf6', 2048, 'TODO'),
  ('Em andamento', '#3b82f6', 3072, 'IN_PROGRESS'),
  ('Em revisão', '#06b6d4', 4096, 'IN_REVIEW'),
  ('Bloqueada', '#ef4444', 5120, 'BLOCKED'),
  ('Concluída', '#22c55e', 6144, 'DONE'),
  ('Cancelada', '#6b7280', 7168, 'CANCELLED')
) AS s("name", "color", "position", "category");

UPDATE "project_tasks" t
SET "stage_id" = st."id"
FROM "project_stages" st
WHERE st."project_id" = t."project_id" AND st."category" = t."status" AND t."stage_id" IS NULL;
