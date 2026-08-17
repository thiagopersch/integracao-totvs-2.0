-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SoapMethod" ADD VALUE 'DELETERECORD';
ALTER TYPE "SoapMethod" ADD VALUE 'ISVALIDDATASERVER';
ALTER TYPE "SoapMethod" ADD VALUE 'EXECUTEPROCESS';
ALTER TYPE "SoapMethod" ADD VALUE 'EXECUTEWITHXMLPARAMS';
ALTER TYPE "SoapMethod" ADD VALUE 'EXECUTEWITHXMLPARAMSASYNC';
ALTER TYPE "SoapMethod" ADD VALUE 'GETPROCESSSTATUS';
ALTER TYPE "SoapMethod" ADD VALUE 'GETSCHEMA2';
ALTER TYPE "SoapMethod" ADD VALUE 'CHECKSERVICEACTIVITY';

-- AlterTable
ALTER TABLE "sentences" ADD COLUMN     "content" TEXT;

-- AlterTable
ALTER TABLE "soap_logs" ADD COLUMN     "endpoint_type_id" TEXT,
ADD COLUMN     "method_id" TEXT;

-- CreateTable
CREATE TABLE "soap_endpoint_types" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soap_endpoint_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soap_endpoint_methods" (
    "id" TEXT NOT NULL,
    "endpoint_type_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soap_endpoint_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "soap_endpoint_types_type_key" ON "soap_endpoint_types"("type");

-- AddForeignKey
ALTER TABLE "soap_endpoint_methods" ADD CONSTRAINT "soap_endpoint_methods_endpoint_type_id_fkey" FOREIGN KEY ("endpoint_type_id") REFERENCES "soap_endpoint_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soap_logs" ADD CONSTRAINT "soap_logs_endpoint_type_id_fkey" FOREIGN KEY ("endpoint_type_id") REFERENCES "soap_endpoint_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soap_logs" ADD CONSTRAINT "soap_logs_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "soap_endpoint_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
