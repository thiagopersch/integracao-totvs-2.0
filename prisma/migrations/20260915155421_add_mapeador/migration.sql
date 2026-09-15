-- CreateTable
CREATE TABLE "mapeador_projetos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "informacoes_adicionais" JSONB,
    "prototipo_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mapeador_projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapeador_etapas" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "condicao" TEXT,
    "regras" TEXT,
    "campos_por_etapa" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapeador_etapas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mapeador_projetos" ADD CONSTRAINT "mapeador_projetos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapeador_etapas" ADD CONSTRAINT "mapeador_etapas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "mapeador_projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
