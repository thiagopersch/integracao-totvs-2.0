-- CreateTable
CREATE TABLE "demand_demand_types" (
    "demand_id" TEXT NOT NULL,
    "demand_type_id" TEXT NOT NULL,

    CONSTRAINT "demand_demand_types_pkey" PRIMARY KEY ("demand_id","demand_type_id")
);

-- CreateIndex
CREATE INDEX "demand_demand_types_demand_type_id_idx" ON "demand_demand_types"("demand_type_id");

-- AddForeignKey
ALTER TABLE "demand_demand_types" ADD CONSTRAINT "demand_demand_types_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_demand_types" ADD CONSTRAINT "demand_demand_types_demand_type_id_fkey" FOREIGN KEY ("demand_type_id") REFERENCES "demand_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: the single type of each existing demand becomes its first link.
INSERT INTO "demand_demand_types" ("demand_id", "demand_type_id")
SELECT "id", "demand_type_id" FROM "demands" WHERE "demand_type_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "demands" DROP CONSTRAINT "demands_demand_type_id_fkey";

-- AlterTable
ALTER TABLE "demands" DROP COLUMN "demand_type_id";
