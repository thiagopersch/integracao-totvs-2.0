-- AlterTable
ALTER TABLE "mapeador_projetos" ADD COLUMN     "cliente_id" TEXT;

-- AddForeignKey
ALTER TABLE "mapeador_projetos" ADD CONSTRAINT "mapeador_projetos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
