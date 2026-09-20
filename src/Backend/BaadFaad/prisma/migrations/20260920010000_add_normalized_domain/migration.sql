-- Additive normalization migration. Compatibility JSON columns remain in place
-- until the controlled backfill and dual-read comparison have completed.

CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "SplitParticipantStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REFUNDED');
CREATE TYPE "InvitationType" AS ENUM ('GROUP', 'SESSION');

ALTER TABLE "Participant" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Receipt"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NPR',
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "subtotalPaisa" BIGINT,
  ADD COLUMN "taxPaisa" BIGINT,
  ADD COLUMN "serviceChargePaisa" BIGINT,
  ADD COLUMN "discountPaisa" BIGINT,
  ADD COLUMN "totalPaisa" BIGINT,
  ADD COLUMN "rawAiData" JSONB,
  ADD COLUMN "parsedAt" TIMESTAMP(3);

ALTER TABLE "Split"
  ADD COLUMN "totalPaisa" BIGINT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Nudge"
  ADD COLUMN "senderId" UUID,
  ADD COLUMN "splitParticipantId" UUID;

ALTER TABLE "Transaction"
  ADD COLUMN "splitId" UUID,
  ADD COLUMN "userId" UUID,
  ADD COLUMN "amountPaisa" BIGINT,
  ADD COLUMN "paidAmountPaisa" BIGINT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NPR',
  ADD COLUMN "providerTransactionId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "providerResponse" JSONB;

CREATE TABLE "GroupMember" (
  "id" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionParticipant" (
  "id" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "userId" UUID,
  "participantId" UUID,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "isHost" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionParticipant_identity_check" CHECK (num_nonnulls("userId", "participantId") = 1)
);

CREATE TABLE "ReceiptItem" (
  "id" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "unitPricePaisa" BIGINT NOT NULL,
  "totalPricePaisa" BIGINT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceiptItem_money_check" CHECK ("quantity" > 0 AND "unitPricePaisa" >= 0 AND "totalPricePaisa" >= 0)
);

CREATE TABLE "SplitParticipant" (
  "id" UUID NOT NULL,
  "splitId" UUID NOT NULL,
  "userId" UUID,
  "participantId" UUID,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "amountPaisa" BIGINT NOT NULL,
  "percentageBps" INTEGER,
  "status" "SplitParticipantStatus" NOT NULL DEFAULT 'UNPAID',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SplitParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SplitParticipant_identity_check" CHECK (num_nonnulls("userId", "participantId") <= 1),
  CONSTRAINT "SplitParticipant_amount_check" CHECK ("amountPaisa" >= 0),
  CONSTRAINT "SplitParticipant_percentage_check" CHECK ("percentageBps" IS NULL OR "percentageBps" BETWEEN 0 AND 10000)
);

CREATE TABLE "SplitItemAssignment" (
  "id" UUID NOT NULL,
  "splitParticipantId" UUID NOT NULL,
  "receiptItemId" UUID NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "amountPaisa" BIGINT NOT NULL,
  CONSTRAINT "SplitItemAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SplitItemAssignment_value_check" CHECK ("quantity" > 0 AND "amountPaisa" >= 0)
);

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "splitId" UUID NOT NULL,
  "paidByUserId" UUID,
  "amountPaisa" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NPR',
  "method" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT NOT NULL DEFAULT '',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_check" CHECK ("amountPaisa" > 0)
);

CREATE TABLE "PaymentAllocation" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "splitParticipantId" UUID NOT NULL,
  "amountPaisa" BIGINT NOT NULL,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAllocation_amount_check" CHECK ("amountPaisa" > 0)
);

CREATE TABLE "Invitation" (
  "id" UUID NOT NULL,
  "type" "InvitationType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "groupId" UUID,
  "sessionId" UUID,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "maxUses" INTEGER NOT NULL DEFAULT 0,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invitation_target_check" CHECK (
    ("type" = 'GROUP' AND "groupId" IS NOT NULL AND "sessionId" IS NULL) OR
    ("type" = 'SESSION' AND "sessionId" IS NOT NULL AND "groupId" IS NULL)
  ),
  CONSTRAINT "Invitation_usage_check" CHECK ("maxUses" >= 0 AND "useCount" >= 0 AND ("maxUses" = 0 OR "useCount" <= "maxUses"))
);

CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
CREATE INDEX "GroupMember_userId_removedAt_idx" ON "GroupMember"("userId", "removedAt");
CREATE UNIQUE INDEX "SessionParticipant_sessionId_userId_key" ON "SessionParticipant"("sessionId", "userId");
CREATE UNIQUE INDEX "SessionParticipant_sessionId_participantId_key" ON "SessionParticipant"("sessionId", "participantId");
CREATE INDEX "SessionParticipant_sessionId_leftAt_joinedAt_idx" ON "SessionParticipant"("sessionId", "leftAt", "joinedAt");
CREATE INDEX "ReceiptItem_receiptId_sortOrder_idx" ON "ReceiptItem"("receiptId", "sortOrder");
CREATE UNIQUE INDEX "SplitParticipant_splitId_userId_key" ON "SplitParticipant"("splitId", "userId");
CREATE UNIQUE INDEX "SplitParticipant_splitId_participantId_key" ON "SplitParticipant"("splitId", "participantId");
CREATE INDEX "SplitParticipant_splitId_status_sortOrder_idx" ON "SplitParticipant"("splitId", "status", "sortOrder");
CREATE UNIQUE INDEX "SplitItemAssignment_splitParticipantId_receiptItemId_key" ON "SplitItemAssignment"("splitParticipantId", "receiptItemId");
CREATE INDEX "SplitItemAssignment_receiptItemId_idx" ON "SplitItemAssignment"("receiptItemId");
CREATE INDEX "Payment_splitId_status_createdAt_idx" ON "Payment"("splitId", "status", "createdAt");
CREATE INDEX "Payment_paidByUserId_createdAt_idx" ON "Payment"("paidByUserId", "createdAt");
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_splitParticipantId_key" ON "PaymentAllocation"("paymentId", "splitParticipantId");
CREATE INDEX "PaymentAllocation_splitParticipantId_idx" ON "PaymentAllocation"("splitParticipantId");
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_groupId_expiresAt_idx" ON "Invitation"("groupId", "expiresAt");
CREATE INDEX "Invitation_sessionId_expiresAt_idx" ON "Invitation"("sessionId", "expiresAt");
CREATE INDEX "Nudge_senderId_createdAt_idx" ON "Nudge"("senderId", "createdAt");
CREATE INDEX "Nudge_splitParticipantId_createdAt_idx" ON "Nudge"("splitParticipantId", "createdAt");
CREATE UNIQUE INDEX "Transaction_providerTransactionId_key" ON "Transaction"("providerTransactionId");
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");
CREATE INDEX "Transaction_splitId_status_createdAt_idx" ON "Transaction"("splitId", "status", "createdAt");
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SplitItemAssignment" ADD CONSTRAINT "SplitItemAssignment_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitItemAssignment" ADD CONSTRAINT "SplitItemAssignment_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "ReceiptItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
