-- AlterTable
ALTER TABLE "clients" ADD COLUMN "billing_months" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "clients" ADD COLUMN "last_payment_date" TIMESTAMP(3);
