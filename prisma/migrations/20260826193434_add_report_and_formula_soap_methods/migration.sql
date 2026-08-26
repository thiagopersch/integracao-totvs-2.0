-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SoapMethod" ADD VALUE 'GETREPORTLIST';
ALTER TYPE "SoapMethod" ADD VALUE 'GETREPORTMETADATA';
ALTER TYPE "SoapMethod" ADD VALUE 'GETREPORTINFO';
ALTER TYPE "SoapMethod" ADD VALUE 'GENERATEREPORT';
ALTER TYPE "SoapMethod" ADD VALUE 'GENERATEREPORTASYNCHRONOUS';
ALTER TYPE "SoapMethod" ADD VALUE 'GETGENERATEDREPORTSTATUS';
ALTER TYPE "SoapMethod" ADD VALUE 'GETGENERATEDREPORTSIZE';
ALTER TYPE "SoapMethod" ADD VALUE 'GETFILECHUNK';
ALTER TYPE "SoapMethod" ADD VALUE 'GETPARAMETERS';
ALTER TYPE "SoapMethod" ADD VALUE 'EXECUTE';
