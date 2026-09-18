-- CreateTable
CREATE TABLE "mapeador_templates_projeto" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "informacoes_adicionais" JSONB,
    "etapas" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapeador_templates_projeto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mapeador_templates_projeto" ADD CONSTRAINT "mapeador_templates_projeto_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
