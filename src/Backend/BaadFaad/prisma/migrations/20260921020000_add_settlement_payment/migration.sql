-- CreateTable
CREATE TABLE "SettlementPayment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "splitId" UUID NOT NULL,
    "fromParticipantId" UUID NOT NULL,
    "toParticipantId" UUID NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT NOT NULL DEFAULT '',
    "recordedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettlementPayment_splitId_createdAt_idx" ON "SettlementPayment"("splitId", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementPayment_fromParticipantId_toParticipantId_idx" ON "SettlementPayment"("fromParticipantId", "toParticipantId");

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
