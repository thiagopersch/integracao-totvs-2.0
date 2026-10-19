-- CreateEnum
CREATE TYPE "MessageTemplateScope" AS ENUM ('PER_CLIENT', 'ALL_CLIENTS');

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN "scope" "MessageTemplateScope" NOT NULL DEFAULT 'PER_CLIENT';
