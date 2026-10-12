-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "hash" CHAR(64),
ADD COLUMN     "prevHash" CHAR(64);

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
