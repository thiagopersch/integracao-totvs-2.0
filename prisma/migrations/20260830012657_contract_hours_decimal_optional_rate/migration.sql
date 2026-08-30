-- AlterTable
ALTER TABLE "client_contracts" ALTER COLUMN "contracted_hours" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "hourly_rate" DROP NOT NULL;
