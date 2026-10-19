-- CreateTable
CREATE TABLE "contract_extra_hours" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_extra_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_extra_hours_contract_id_period_idx" ON "contract_extra_hours"("contract_id", "period");

-- AddForeignKey
ALTER TABLE "contract_extra_hours" ADD CONSTRAINT "contract_extra_hours_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "client_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
