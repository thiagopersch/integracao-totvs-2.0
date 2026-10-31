-- CreateTable
CREATE TABLE "requester_clients" (
    "requester_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "requester_clients_pkey" PRIMARY KEY ("requester_id","client_id")
);

-- CreateIndex
CREATE INDEX "requester_clients_client_id_idx" ON "requester_clients"("client_id");

-- AddForeignKey
ALTER TABLE "requester_clients" ADD CONSTRAINT "requester_clients_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "requesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requester_clients" ADD CONSTRAINT "requester_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy each requester's single client into the new link table before dropping the column.
INSERT INTO "requester_clients" ("requester_id", "client_id")
SELECT "id", "client_id" FROM "requesters" WHERE "client_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "requesters" DROP CONSTRAINT "requesters_client_id_fkey";

-- DropIndex
DROP INDEX "requesters_client_id_idx";

-- AlterTable
ALTER TABLE "requesters" DROP COLUMN "client_id";
