-- CreateTable
CREATE TABLE "mapeador_temas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapeador_temas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mapeador_temas" ADD CONSTRAINT "mapeador_temas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
