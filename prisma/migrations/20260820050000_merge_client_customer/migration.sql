-- ============================================================================
-- Merge the TOTVS "Client" entity and the demand-tracking "Customer" entity
-- into a single "clients" table. Customer rows are appended to clients
-- (preserving id, so FKs on customer_contracts/demands can simply be
-- repointed to the same row id in the merged table).
-- ============================================================================

-- Step 1: widen "clients" with Customer's columns (nullable-first, safe on a
-- populated table), and relax link_crm (TOTVS-only) to optional since
-- demand-only clients won't have one.
ALTER TABLE "clients" ADD COLUMN "legal_name" TEXT;
ALTER TABLE "clients" ADD COLUMN "document" TEXT;
ALTER TABLE "clients" ADD COLUMN "email" TEXT;
ALTER TABLE "clients" ADD COLUMN "phone" TEXT;
ALTER TABLE "clients" ADD COLUMN "responsible" TEXT;
ALTER TABLE "clients" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#22c55e';
ALTER TABLE "clients" ADD COLUMN "notes" TEXT;
ALTER TABLE "clients" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ALTER COLUMN "link_crm" DROP NOT NULL;

-- Step 2: append every existing "customers" row into "clients", preserving id
-- so that customer_contracts/demands foreign keys keep pointing at a valid row
-- once repointed to the clients table below.
INSERT INTO "clients" (
  "id", "organization_id", "name", "legal_name", "document", "email", "phone",
  "responsible", "color", "notes", "favorite", "status",
  "created_at", "updated_at", "deleted_at"
)
SELECT
  "id", "organization_id", "name", "legal_name", "document", "email", "phone",
  "responsible", "color", "notes", "favorite", "status",
  "created_at", "updated_at", "deleted_at"
FROM "customers";

-- Step 3: repoint customer_contracts -> client_contracts.
ALTER TABLE "customer_contracts" DROP CONSTRAINT "customer_contracts_customer_id_fkey";
ALTER TABLE "customer_contracts" RENAME COLUMN "customer_id" TO "client_id";
ALTER TABLE "customer_contracts" RENAME TO "client_contracts";
ALTER TABLE "client_contracts" ADD CONSTRAINT "client_contracts_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: repoint demands.customer_id -> demands.client_id.
ALTER TABLE "demands" DROP CONSTRAINT "demands_customer_id_fkey";
ALTER TABLE "demands" RENAME COLUMN "customer_id" TO "client_id";
ALTER TABLE "demands" ADD CONSTRAINT "demands_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: drop the now-empty "customers" table.
ALTER TABLE "customers" DROP CONSTRAINT "customers_organization_id_fkey";
DROP TABLE "customers";

-- Step 6: search coverage for the fields the unified Clients page filters on.
CREATE INDEX "clients_document_search_idx" ON "clients" USING gin (immutable_unaccent(lower("document")) gin_trgm_ops);
CREATE INDEX "clients_email_search_idx" ON "clients" USING gin (immutable_unaccent(lower("email")) gin_trgm_ops);
