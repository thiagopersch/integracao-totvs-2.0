-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "client_id" TEXT;

-- AlterTable
ALTER TABLE "requesters" ADD COLUMN     "client_id" TEXT;

-- CreateTable
CREATE TABLE "department_requesters" (
    "department_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,

    CONSTRAINT "department_requesters_pkey" PRIMARY KEY ("department_id","requester_id")
);

-- CreateIndex
CREATE INDEX "department_requesters_requester_id_idx" ON "department_requesters"("requester_id");

-- CreateIndex
CREATE INDEX "departments_client_id_idx" ON "departments"("client_id");

-- CreateIndex
CREATE INDEX "requesters_client_id_idx" ON "requesters"("client_id");

-- AddForeignKey
ALTER TABLE "requesters" ADD CONSTRAINT "requesters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_requesters" ADD CONSTRAINT "department_requesters_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_requesters" ADD CONSTRAINT "department_requesters_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "requesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
