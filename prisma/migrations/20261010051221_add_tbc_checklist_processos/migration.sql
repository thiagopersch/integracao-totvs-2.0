-- CreateTable
CREATE TABLE "tbc_checklist_processos" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "cod_coligada" INTEGER NOT NULL,
    "cod_filial" INTEGER NOT NULL,
    "level_education" INTEGER NOT NULL,
    "idps" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbc_checklist_processos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbc_checklist_processos_checklist_id_cod_coligada_idps_key" ON "tbc_checklist_processos"("checklist_id", "cod_coligada", "idps");

-- AddForeignKey
ALTER TABLE "tbc_checklist_processos" ADD CONSTRAINT "tbc_checklist_processos_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "tbc_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
