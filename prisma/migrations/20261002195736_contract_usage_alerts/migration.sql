-- AlterTable
ALTER TABLE "client_contracts" ADD COLUMN     "notify_client" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "email_settings" ADD COLUMN     "contract_alert_email" TEXT;

-- CreateTable
CREATE TABLE "contract_usage_alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "used_hours" DOUBLE PRECISION NOT NULL,
    "contracted_hours" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_usage_alerts_client_id_period_threshold_key" ON "contract_usage_alerts"("client_id", "period", "threshold");

-- AddForeignKey
ALTER TABLE "contract_usage_alerts" ADD CONSTRAINT "contract_usage_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_usage_alerts" ADD CONSTRAINT "contract_usage_alerts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
