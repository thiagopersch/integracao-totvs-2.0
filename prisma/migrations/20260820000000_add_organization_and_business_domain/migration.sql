-- ============================================================================
-- Rename legacy role enum to make room for the new granular Role model
-- ============================================================================
ALTER TYPE "Role" RENAME TO "UserRoleLevel";

-- ============================================================================
-- Users: avatar column
-- ============================================================================
ALTER TABLE "users" ADD COLUMN "image" TEXT;

-- ============================================================================
-- Multi-tenancy root
-- ============================================================================
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "document" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "configs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

INSERT INTO "organizations" ("id", "name", "slug", "plan", "status", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'Empresa Padrão', 'default', 'free', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================================
-- Step 1: add organization_id as NULLABLE first (safe on populated tables)
-- ============================================================================
ALTER TABLE "users" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "dataservers" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "processes" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "clients" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "tbcs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "filters" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "backups" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sentence_categories" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sentences" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "totvs_systems" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "soap_logs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "soap_templates" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "soap_favorites" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" TEXT;

-- ============================================================================
-- Step 2: backfill every existing row to the default organization
-- ============================================================================
UPDATE "users" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "dataservers" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "processes" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "clients" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "tbcs" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "filters" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "backups" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "sentence_categories" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "sentences" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "totvs_systems" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "soap_logs" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "soap_templates" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "soap_favorites" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;
UPDATE "audit_logs" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "organization_id" IS NULL;

-- ============================================================================
-- Step 3: enforce NOT NULL now that every row has a tenant (audit_logs stays
-- optional -- historical rows from before multi-tenancy may legitimately lack one)
-- ============================================================================
ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "dataservers" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "processes" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "tbcs" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "filters" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "backups" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sentence_categories" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sentences" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "totvs_systems" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "soap_logs" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "soap_templates" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "soap_favorites" ALTER COLUMN "organization_id" SET NOT NULL;

-- ============================================================================
-- Step 4: foreign keys
-- ============================================================================
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dataservers" ADD CONSTRAINT "dataservers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "processes" ADD CONSTRAINT "processes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tbcs" ADD CONSTRAINT "tbcs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "filters" ADD CONSTRAINT "filters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "backups" ADD CONSTRAINT "backups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sentence_categories" ADD CONSTRAINT "sentence_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "totvs_systems" ADD CONSTRAINT "totvs_systems_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "soap_logs" ADD CONSTRAINT "soap_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "soap_templates" ADD CONSTRAINT "soap_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "soap_favorites" ADD CONSTRAINT "soap_favorites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Step 5: rescope uniqueness to per-tenant (must run after backfill, since
-- every existing row shares the same organization_id and would otherwise collide)
-- ============================================================================
DROP INDEX "dataservers_code_key";
CREATE UNIQUE INDEX "dataservers_organization_id_code_key" ON "dataservers"("organization_id", "code");

DROP INDEX "processes_code_key";
CREATE UNIQUE INDEX "processes_organization_id_code_key" ON "processes"("organization_id", "code");

DROP INDEX "clients_link_crm_key";
CREATE UNIQUE INDEX "clients_organization_id_link_crm_key" ON "clients"("organization_id", "link_crm");

DROP INDEX "tbcs_link_key";
CREATE UNIQUE INDEX "tbcs_organization_id_link_key" ON "tbcs"("organization_id", "link");

DROP INDEX "sentence_categories_code_key";
CREATE UNIQUE INDEX "sentence_categories_organization_id_code_key" ON "sentence_categories"("organization_id", "code");

DROP INDEX "sentences_code_key";
CREATE UNIQUE INDEX "sentences_organization_id_code_key" ON "sentences"("organization_id", "code");

DROP INDEX "totvs_systems_code_key";
CREATE UNIQUE INDEX "totvs_systems_organization_id_code_key" ON "totvs_systems"("organization_id", "code");

-- ============================================================================
-- Step 6: rebuild RBAC. The old role_permissions/permissions pair was tied to
-- the User.role enum and confirmed unused by the application -- safe to drop
-- and recreate with the granular resource/action shape.
-- ============================================================================
DROP TABLE "role_permissions";
DROP TABLE "permissions";

CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Step 7: business-domain enums
-- ============================================================================
CREATE TYPE "DemandStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- ============================================================================
-- Step 8: business-domain tables (fresh -- no pre-existing data risk)
-- ============================================================================
CREATE TABLE "analysts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "hourly_rate" DOUBLE PRECISION,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "photo" TEXT,
    "team" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "analysts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analysts_user_id_key" ON "analysts"("user_id");
ALTER TABLE "analysts" ADD CONSTRAINT "analysts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analysts" ADD CONSTRAINT "analysts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "responsible" TEXT,
    "color" TEXT NOT NULL DEFAULT '#22c55e',
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "customer_contracts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "contracted_hours" INTEGER NOT NULL,
    "hourly_rate" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contracts_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "requesters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requesters_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "requesters" ADD CONSTRAINT "requesters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "demand_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#a855f7',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "demand_types_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "demand_types" ADD CONSTRAINT "demand_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "demands" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DemandStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "analyst_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "requester_id" TEXT,
    "department_id" TEXT,
    "demand_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "demands" ADD CONSTRAINT "demands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demands" ADD CONSTRAINT "demands_analyst_id_fkey" FOREIGN KEY ("analyst_id") REFERENCES "analysts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demands" ADD CONSTRAINT "demands_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demands" ADD CONSTRAINT "demands_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "requesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demands" ADD CONSTRAINT "demands_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demands" ADD CONSTRAINT "demands_demand_type_id_fkey" FOREIGN KEY ("demand_type_id") REFERENCES "demand_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "comments" ADD CONSTRAINT "comments_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tags_organization_id_name_key" ON "tags"("organization_id", "name");
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "demand_tags" (
    "demand_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "demand_tags_pkey" PRIMARY KEY ("demand_id", "tag_id")
);
ALTER TABLE "demand_tags" ADD CONSTRAINT "demand_tags_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_tags" ADD CONSTRAINT "demand_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_settings_user_id_channel_key" ON "notification_settings"("user_id", "channel");
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Step 9: accent-insensitive / fuzzy search support.
-- unaccent() ships STABLE, not IMMUTABLE, so it cannot be used directly in a
-- functional index -- wrap it in a small IMMUTABLE function first.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION "immutable_unaccent"(text) RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE INDEX "filters_filter_search_idx" ON "filters" USING gin (immutable_unaccent(lower("filter")) gin_trgm_ops);
CREATE INDEX "sentences_name_search_idx" ON "sentences" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);
CREATE INDEX "sentences_code_search_idx" ON "sentences" USING gin (immutable_unaccent(lower("code")) gin_trgm_ops);
CREATE INDEX "clients_name_search_idx" ON "clients" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);
CREATE INDEX "tbcs_name_search_idx" ON "tbcs" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);
CREATE INDEX "customers_name_search_idx" ON "customers" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);
CREATE INDEX "demands_name_search_idx" ON "demands" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);
