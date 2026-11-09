-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('SOAP', 'RUBEUS', 'CIELO', 'TPI', 'GOOGLE_SHEETS', 'SMTP', 'BLOB');

-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration" "IntegrationKind" NOT NULL,
    "timeout_ms" INTEGER NOT NULL,
    "max_retries" INTEGER NOT NULL DEFAULT 0,
    "retry_delay_ms" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_organization_id_integration_key" ON "integration_settings"("organization_id", "integration");

-- AddForeignKey
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

