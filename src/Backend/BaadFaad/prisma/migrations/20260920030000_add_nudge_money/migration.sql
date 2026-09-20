ALTER TABLE "Nudge" ADD COLUMN "amountPaisa" BIGINT;

UPDATE "Nudge"
SET "amountPaisa" = ROUND("amount" * 100)::BIGINT
WHERE "amountPaisa" IS NULL;

CREATE INDEX "Nudge_senderId_splitParticipantId_createdAt_idx"
ON "Nudge"("senderId", "splitParticipantId", "createdAt" DESC);
