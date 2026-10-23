-- AlterTable
ALTER TABLE "demand_sheet_syncs" ADD COLUMN "layout" TEXT NOT NULL DEFAULT 'tabs',
ADD COLUMN "analyst_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
