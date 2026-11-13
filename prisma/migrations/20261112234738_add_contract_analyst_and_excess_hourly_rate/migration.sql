-- AlterTable
ALTER TABLE "analysts" ADD COLUMN     "excess_hourly_rate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "contract_analysts" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "analyst_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_analysts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_analysts_analyst_id_idx" ON "contract_analysts"("analyst_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_analysts_contract_id_analyst_id_key" ON "contract_analysts"("contract_id", "analyst_id");

-- AddForeignKey
ALTER TABLE "contract_analysts" ADD CONSTRAINT "contract_analysts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "client_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_analysts" ADD CONSTRAINT "contract_analysts_analyst_id_fkey" FOREIGN KEY ("analyst_id") REFERENCES "analysts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
