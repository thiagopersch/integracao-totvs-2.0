-- CreateTable
CREATE TABLE "tbc_checklists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tbc_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coligate_context" INTEGER,
    "branch_context" INTEGER,
    "level_education_context" INTEGER,
    "listing_dataserver_code" TEXT,
    "listing_id_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "listing_label_field" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tbc_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbc_checklist_dataservers" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "dataserver_code" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "fields" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbc_checklist_dataservers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbc_checklists_tbc_id_idx" ON "tbc_checklists"("tbc_id");

-- CreateIndex
CREATE UNIQUE INDEX "tbc_checklist_dataservers_checklist_id_dataserver_code_key" ON "tbc_checklist_dataservers"("checklist_id", "dataserver_code");

-- AddForeignKey
ALTER TABLE "tbc_checklists" ADD CONSTRAINT "tbc_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbc_checklists" ADD CONSTRAINT "tbc_checklists_tbc_id_fkey" FOREIGN KEY ("tbc_id") REFERENCES "tbcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbc_checklist_dataservers" ADD CONSTRAINT "tbc_checklist_dataservers_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "tbc_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
