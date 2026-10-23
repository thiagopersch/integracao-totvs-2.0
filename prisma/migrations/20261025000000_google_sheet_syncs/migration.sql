-- CreateTable
CREATE TABLE "google_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "service_account_json" TEXT NOT NULL,
    "service_account_email" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_sheet_syncs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spreadsheet_url" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'currentMonth',
    "client_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schedule" "BackupSchedule" NOT NULL DEFAULT 'NONE',
    "schedule_time" TEXT,
    "day_of_month" INTEGER,
    "sync_on_demand_change" BOOLEAN NOT NULL DEFAULT true,
    "pending_sync_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_run_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "demand_sheet_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_settings_organization_id_key" ON "google_settings"("organization_id");

-- CreateIndex
CREATE INDEX "demand_sheet_syncs_organization_id_deleted_at_idx" ON "demand_sheet_syncs"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "demand_sheet_syncs_is_active_next_run_at_idx" ON "demand_sheet_syncs"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "demand_sheet_syncs_is_active_pending_sync_at_idx" ON "demand_sheet_syncs"("is_active", "pending_sync_at");

-- AddForeignKey
ALTER TABLE "google_settings" ADD CONSTRAINT "google_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_sheet_syncs" ADD CONSTRAINT "demand_sheet_syncs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
