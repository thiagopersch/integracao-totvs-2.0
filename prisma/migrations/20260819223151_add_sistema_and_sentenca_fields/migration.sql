-- AlterTable
ALTER TABLE "filters" ADD COLUMN     "cod_coligada_sentenca" TEXT,
ADD COLUMN     "cod_sistema_sentenca" TEXT;

-- AlterTable
ALTER TABLE "sentences" ADD COLUMN     "cod_coligada" TEXT;

-- CreateTable
CREATE TABLE "totvs_systems" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "internal_name" TEXT NOT NULL,
    "external_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "totvs_systems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "totvs_systems_code_key" ON "totvs_systems"("code");
