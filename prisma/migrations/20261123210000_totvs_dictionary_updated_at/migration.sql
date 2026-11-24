-- Marks when each dictionary row was last written; "replace" imports delete the rows not touched by the import.
ALTER TABLE "totvs_dictionary_columns" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
