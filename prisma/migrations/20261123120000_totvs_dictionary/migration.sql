-- CreateTable
CREATE TABLE "totvs_dictionary_columns" (
    "table" TEXT NOT NULL,
    "column" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "totvs_dictionary_columns_pkey" PRIMARY KEY ("table","column")
);
