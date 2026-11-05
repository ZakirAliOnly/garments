-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "extraHoursRate" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CashBookEntry" ADD COLUMN     "paymentMethodId" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransfer" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "requestKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerPayroll" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "monthlyWage" DECIMAL(18,2) NOT NULL,
    "absentDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "paymentMethodName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerPayroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "hours" DECIMAL(10,2),
    "rate" DECIMAL(18,2),
    "entryDate" TIMESTAMP(3) NOT NULL,
    "paymentMethodName" TEXT,
    "notes" TEXT,
    "requestKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransfer_requestKey_key" ON "PaymentTransfer"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPayroll_workerId_month_key" ON "WorkerPayroll"("workerId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAdjustment_requestKey_key" ON "PayrollAdjustment"("requestKey");

-- CreateIndex
CREATE INDEX "CashBookEntry_paymentMethodId_entryDate_idx" ON "CashBookEntry"("paymentMethodId", "entryDate");

-- CreateIndex
CREATE INDEX "CashBookEntry_sourceType_sourceId_idx" ON "CashBookEntry"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "PaymentTransfer" ADD CONSTRAINT "PaymentTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransfer" ADD CONSTRAINT "PaymentTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayroll" ADD CONSTRAINT "WorkerPayroll_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "WorkerPayroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookEntry" ADD CONSTRAINT "CashBookEntry_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve historical cash movement. Known invoice/notes methods retain their channel;
-- unlabelled historical entries use Cash (there is no reliable old channel field).
INSERT INTO "PaymentMethod" (id,name,"updatedAt")
SELECT 'pm_' || md5(name), name, CURRENT_TIMESTAMP FROM (
  SELECT unnest(ARRAY['Cash','Bank','EasyPaisa','Mobile Wallet']) AS name
  UNION SELECT trim("paymentMethod") FROM "Invoice" WHERE trim(coalesce("paymentMethod",'')) <> ''
  UNION SELECT trim(substring(notes from ' via ([^|]+)$')) FROM "CashBookEntry" WHERE notes ~ ' via ([^|]+)$'
) n WHERE name IS NOT NULL AND name <> '' ON CONFLICT (name) DO NOTHING;
UPDATE "CashBookEntry" e SET "paymentMethodId" = (
  SELECT m.id FROM "PaymentMethod" m WHERE m.name = coalesce(
    nullif(trim((SELECT i."paymentMethod" FROM "Invoice" i WHERE i.id=e."invoiceId")),''),
    nullif(trim(substring(e.notes from ' via ([^|]+)$')),''),'Cash')
);
ALTER TABLE "CashBookEntry" ALTER COLUMN "paymentMethodId" SET NOT NULL;
UPDATE "CashBookEntry" SET "sourceType"='invoice', "sourceId"="invoiceId" WHERE "invoiceId" IS NOT NULL;
UPDATE "CashBookEntry" SET "sourceType"='purchase' WHERE "sourceType"='manual' AND description LIKE 'Purchase %';
UPDATE "CashBookEntry" SET "sourceType"='customer-opening', "sourceId"="customerId" WHERE "sourceType"='manual' AND description LIKE 'Opening advance%';
ALTER TABLE "PaymentTransfer" ADD CONSTRAINT "transfer_different_methods" CHECK ("fromId" <> "toId"), ADD CONSTRAINT "transfer_positive_amount" CHECK (amount > 0);
ALTER TABLE "WorkerPayroll" ADD CONSTRAINT "payroll_absence_range" CHECK ("absentDays" >= 0 AND "absentDays" <= 30), ADD CONSTRAINT "payroll_wage_positive" CHECK ("monthlyWage" >= 0 AND "paidAmount" >= 0);
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "adjustment_kind" CHECK (kind IN ('advance','extra')), ADD CONSTRAINT "adjustment_positive" CHECK (amount > 0);

-- Backward compatibility: the currently deployed app omits paymentMethodId.
-- Only omitted IDs are resolved here; new APIs always pass a validated active ID.
CREATE FUNCTION "fill_legacy_cashbook_method"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE method_name TEXT;
BEGIN
  IF NEW."paymentMethodId" IS NULL THEN
    SELECT nullif(trim(i."paymentMethod"),'') INTO method_name FROM "Invoice" i WHERE i.id=NEW."invoiceId";
    method_name := coalesce(method_name,nullif(trim(substring(NEW.notes from ' via ([^|]+)$')),''),'Cash');
    INSERT INTO "PaymentMethod" (id,name,"updatedAt") VALUES ('pm_' || md5(method_name),method_name,CURRENT_TIMESTAMP) ON CONFLICT (name) DO NOTHING;
    SELECT id INTO NEW."paymentMethodId" FROM "PaymentMethod" WHERE name=method_name;
    IF NEW."invoiceId" IS NOT NULL THEN NEW."sourceType" := 'invoice'; NEW."sourceId" := NEW."invoiceId";
    ELSIF NEW.description LIKE 'Purchase %' THEN NEW."sourceType" := 'purchase';
    ELSIF NEW.description LIKE 'Opening advance%' THEN NEW."sourceType" := 'customer-opening'; NEW."sourceId" := NEW."customerId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "cashbook_legacy_method" BEFORE INSERT ON "CashBookEntry" FOR EACH ROW EXECUTE FUNCTION "fill_legacy_cashbook_method"();
