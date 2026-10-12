-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "seq" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_seq_key" ON "audit_logs"("seq");

-- CreateIndex
CREATE INDEX "audit_logs_seq_idx" ON "audit_logs"("seq");

