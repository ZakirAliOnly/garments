CREATE TABLE "ActivityEvent" (
 "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "type" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
 "description" TEXT NOT NULL, "actorId" TEXT, "actorName" TEXT NOT NULL,
 "actorEmail" TEXT, "amount" DECIMAL(18,2), "direction" TEXT,
 "status" TEXT, "method" TEXT
);
CREATE INDEX "ActivityEvent_createdAt_id_idx" ON "ActivityEvent" ("createdAt", "id");
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent" ("type", "createdAt");

-- Record only selected display fields, never request bodies, password hashes or notes.
-- Triggers share the originating transaction: failures and retries leave no extra events.
CREATE FUNCTION garments_record_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 d jsonb; a jsonb; event_type text; label text; detail text; value numeric;
 flow text; state text; method_name text; verb text;
BEGIN
 d := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_OP = 'UPDATE' AND to_jsonb(OLD) - 'updatedAt' = to_jsonb(NEW) - 'updatedAt' THEN RETURN NEW; END IF;
 a := COALESCE(NULLIF(current_setting('garments.actor', true), '')::jsonb, '{}'::jsonb);
 verb := CASE TG_OP WHEN 'INSERT' THEN 'Created' WHEN 'DELETE' THEN 'Deleted' ELSE 'Updated' END;
 label := CASE TG_TABLE_NAME
  WHEN 'Invoice' THEN 'Invoice' WHEN 'CashBookEntry' THEN 'Payment'
  WHEN 'Worker' THEN 'Worker' WHEN 'WorkerTask' THEN 'Task'
  WHEN 'WorkerPayroll' THEN 'Payroll' WHEN 'PayrollAdjustment' THEN 'Payroll Adjustment'
  WHEN 'RefundRequest' THEN 'Refund / Replacement' WHEN 'StockItem' THEN 'Stock'
  WHEN 'Purchase' THEN 'Purchase' WHEN 'Supplier' THEN 'Supplier'
  WHEN 'PaymentMethod' THEN 'Payment Method' WHEN 'PaymentTransfer' THEN 'Transfer'
  WHEN 'AdminUser' THEN 'User' WHEN 'Customer' THEN 'Customer'
  ELSE TG_TABLE_NAME END;
 event_type := label || ' ' || verb;
 detail := COALESCE(d->>'invNumber', d->>'poNumber', d->>'rrNumber', d->>'taskId', d->>'name', d->>'description', d->>'id');
 IF TG_TABLE_NAME = 'Invoice' THEN
   detail := (d->>'invNumber') || ' — ' || (d->>'customerName');
   value := (d->>'total')::numeric;
   state := d->>'status';
 ELSIF TG_TABLE_NAME = 'CashBookEntry' THEN
   value := (d->>'amount')::numeric;
   SELECT name INTO method_name FROM "PaymentMethod" WHERE id = d->>'paymentMethodId';
   IF TG_OP = 'INSERT' THEN
     flow := CASE d->>'type' WHEN 'credit' THEN 'in' ELSE 'out' END;
     event_type := CASE flow WHEN 'in' THEN 'Payment Received' ELSE 'Payment Made' END;
   END IF;
 ELSIF TG_TABLE_NAME = 'Purchase' THEN
   value := (d->>'total')::numeric; state := d->>'status'; detail := detail || ' — ' || (d->>'stockName');
 ELSIF TG_TABLE_NAME = 'RefundRequest' THEN
   value := (d->>'amount')::numeric; state := d->>'type'; detail := detail || ' — ' || (d->>'customerName');
 ELSIF TG_TABLE_NAME = 'WorkerTask' THEN
   state := d->>'status'; detail := detail || ' — ' || (d->>'itemDescription');
 ELSIF TG_TABLE_NAME = 'WorkerPayroll' THEN
   SELECT name INTO detail FROM "Worker" WHERE id = d->>'workerId';
   detail := COALESCE(detail, 'Worker') || ' — ' || (d->>'month');
   value := (d->>'paidAmount')::numeric;
   state := CASE WHEN d->>'paidAt' IS NULL THEN 'unpaid' ELSE 'paid' END;
 ELSIF TG_TABLE_NAME = 'PayrollAdjustment' THEN
   detail := (d->>'kind') || ' — payroll adjustment'; value := (d->>'amount')::numeric;
 ELSIF TG_TABLE_NAME = 'PaymentTransfer' THEN
   SELECT f.name || ' → ' || t.name INTO detail FROM "PaymentMethod" f, "PaymentMethod" t WHERE f.id=d->>'fromId' AND t.id=d->>'toId';
   value := (d->>'amount')::numeric;
 ELSIF TG_TABLE_NAME IN ('PaymentMethod','AdminUser') THEN
   state := CASE WHEN (d->>'active')::boolean THEN 'active' ELSE 'disabled' END;
 END IF;
 INSERT INTO "ActivityEvent" ("type","entityType","entityId","description","actorId","actorName","actorEmail","amount","direction","status","method")
 VALUES (event_type,TG_TABLE_NAME,d->>'id',COALESCE(detail,label),a->>'id',COALESCE(a->>'name','System / unavailable'),a->>'email',value,flow,state,method_name);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['Invoice','CashBookEntry','Worker','WorkerTask','WorkerPayroll','PayrollAdjustment','RefundRequest','StockItem','Purchase','Supplier','PaymentMethod','PaymentTransfer','AdminUser','Customer'] LOOP
  EXECUTE format('CREATE TRIGGER activity_record AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION garments_record_activity()',table_name);
 END LOOP;
END;
$$;
