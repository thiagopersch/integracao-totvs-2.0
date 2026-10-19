-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#f59e0b';

-- AlterTable
ALTER TABLE "requesters" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#0ea5e9';
-- CreateTable
CREATE TABLE "demand_analysts" (
    "demand_id" TEXT NOT NULL,
    "analyst_id" TEXT NOT NULL,

    CONSTRAINT "demand_analysts_pkey" PRIMARY KEY ("demand_id","analyst_id")
);

-- CreateTable
CREATE TABLE "demand_requesters" (
    "demand_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,

    CONSTRAINT "demand_requesters_pkey" PRIMARY KEY ("demand_id","requester_id")
);

-- CreateTable
CREATE TABLE "demand_departments" (
    "demand_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,

    CONSTRAINT "demand_departments_pkey" PRIMARY KEY ("demand_id","department_id")
);

-- CreateIndex
CREATE INDEX "demand_analysts_analyst_id_idx" ON "demand_analysts"("analyst_id");

-- CreateIndex
CREATE INDEX "demand_requesters_requester_id_idx" ON "demand_requesters"("requester_id");

-- CreateIndex
CREATE INDEX "demand_departments_department_id_idx" ON "demand_departments"("department_id");

-- AddForeignKey
ALTER TABLE "demand_analysts" ADD CONSTRAINT "demand_analysts_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_analysts" ADD CONSTRAINT "demand_analysts_analyst_id_fkey" FOREIGN KEY ("analyst_id") REFERENCES "analysts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requesters" ADD CONSTRAINT "demand_requesters_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requesters" ADD CONSTRAINT "demand_requesters_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "requesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_departments" ADD CONSTRAINT "demand_departments_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_departments" ADD CONSTRAINT "demand_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: the single analyst/requester/department of each existing demand becomes its first link.
INSERT INTO "demand_analysts" ("demand_id", "analyst_id")
SELECT "id", "analyst_id" FROM "demands" WHERE "analyst_id" IS NOT NULL;

INSERT INTO "demand_requesters" ("demand_id", "requester_id")
SELECT "id", "requester_id" FROM "demands" WHERE "requester_id" IS NOT NULL;

INSERT INTO "demand_departments" ("demand_id", "department_id")
SELECT "id", "department_id" FROM "demands" WHERE "department_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "demands" DROP CONSTRAINT "demands_analyst_id_fkey";

-- DropForeignKey
ALTER TABLE "demands" DROP CONSTRAINT "demands_department_id_fkey";

-- DropForeignKey
ALTER TABLE "demands" DROP CONSTRAINT "demands_requester_id_fkey";

-- DropIndex
DROP INDEX "demands_analyst_id_idx";

-- AlterTable
ALTER TABLE "demands" DROP COLUMN "analyst_id",
DROP COLUMN "department_id",
DROP COLUMN "requester_id";
