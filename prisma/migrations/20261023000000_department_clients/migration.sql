-- CreateTable
CREATE TABLE "department_clients" (
    "department_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "department_clients_pkey" PRIMARY KEY ("department_id","client_id")
);

-- CreateIndex
CREATE INDEX "department_clients_client_id_idx" ON "department_clients"("client_id");

-- AddForeignKey
ALTER TABLE "department_clients" ADD CONSTRAINT "department_clients_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_clients" ADD CONSTRAINT "department_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy each department's single client into the new link table before dropping the column.
INSERT INTO "department_clients" ("department_id", "client_id")
SELECT "id", "client_id" FROM "departments" WHERE "client_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_client_id_fkey";

-- DropIndex
DROP INDEX "departments_client_id_idx";

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "client_id";
