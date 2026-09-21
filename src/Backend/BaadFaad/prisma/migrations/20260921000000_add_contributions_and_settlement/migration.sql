-- AlterTable
ALTER TABLE "Split" ADD COLUMN "contributions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Split" ADD COLUMN "settlement" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SplitParticipant" ADD COLUMN "paidAmountPaisa" BIGINT NOT NULL DEFAULT 0;
