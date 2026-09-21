import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSettlement, enrichSettlementWithPayments } from '../utils/settlementEngine.js';
import { toPaisa, fromPaisa } from '../utils/money.js';

test('Test Case 1 (Section 22): 5 participants, Rs. 1000 bill, incremental repayments to host', () => {
  // 1. Setup participants
  const participants = [
    { id: 'Host', name: 'Host', shareAmount: 200, paidAmount: 1000 },
    { id: 'A', name: 'A', shareAmount: 200, paidAmount: 0 },
    { id: 'B', name: 'B', shareAmount: 200, paidAmount: 0 },
    { id: 'C', name: 'C', shareAmount: 200, paidAmount: 0 },
    { id: 'D', name: 'D', shareAmount: 200, paidAmount: 0 },
  ];

  // 2. Calculate baseline directed settlement obligations
  const settlement = calculateSettlement(participants);

  assert.equal(settlement.transfers.length, 4);
  assert.deepEqual(
    settlement.transfers.map((t) => ({ from: t.fromParticipantId, to: t.toParticipantId, amount: t.amount })),
    [
      { from: 'A', to: 'Host', amount: 200 },
      { from: 'B', to: 'Host', amount: 200 },
      { from: 'C', to: 'Host', amount: 200 },
      { from: 'D', to: 'Host', amount: 200 },
    ]
  );

  // 3. Stage 1 Payments:
  // A pays 100, B pays 200, C pays 0, D pays 200
  const stage1Payments = [
    { fromParticipantId: 'A', toParticipantId: 'Host', amountPaisa: 10000n },
    { fromParticipantId: 'B', toParticipantId: 'Host', amountPaisa: 20000n },
    { fromParticipantId: 'D', toParticipantId: 'Host', amountPaisa: 20000n },
  ];

  const enriched1 = enrichSettlementWithPayments(settlement.transfers, stage1Payments);

  const transferA = enriched1.transfers.find((t) => t.fromParticipantId === 'A');
  assert.equal(transferA.dueAmount, 200);
  assert.equal(transferA.paidAmount, 100);
  assert.equal(transferA.remainingAmount, 100);
  assert.equal(transferA.status, 'PARTIAL');

  const transferB = enriched1.transfers.find((t) => t.fromParticipantId === 'B');
  assert.equal(transferB.dueAmount, 200);
  assert.equal(transferB.paidAmount, 200);
  assert.equal(transferB.remainingAmount, 0);
  assert.equal(transferB.status, 'PAID');

  const transferC = enriched1.transfers.find((t) => t.fromParticipantId === 'C');
  assert.equal(transferC.dueAmount, 200);
  assert.equal(transferC.paidAmount, 0);
  assert.equal(transferC.remainingAmount, 200);
  assert.equal(transferC.status, 'UNPAID');

  const transferD = enriched1.transfers.find((t) => t.fromParticipantId === 'D');
  assert.equal(transferD.dueAmount, 200);
  assert.equal(transferD.paidAmount, 200);
  assert.equal(transferD.remainingAmount, 0);
  assert.equal(transferD.status, 'PAID');

  // Summary checks
  assert.equal(enriched1.totalDue, 800);
  assert.equal(enriched1.totalPaid, 500);
  assert.equal(enriched1.totalRemaining, 300);
  assert.equal(enriched1.isFullySettled, false);

  // 4. Stage 2 Payments:
  // A pays remaining 100, C pays 200
  const stage2Payments = [
    ...stage1Payments,
    { fromParticipantId: 'A', toParticipantId: 'Host', amountPaisa: 10000n },
    { fromParticipantId: 'C', toParticipantId: 'Host', amountPaisa: 20000n },
  ];

  const enriched2 = enrichSettlementWithPayments(settlement.transfers, stage2Payments);

  assert.equal(enriched2.totalDue, 800);
  assert.equal(enriched2.totalPaid, 800);
  assert.equal(enriched2.totalRemaining, 0);
  assert.equal(enriched2.isFullySettled, true);
  assert.ok(enriched2.transfers.every((t) => t.status === 'PAID'));
});

test('Test Case 2 (Section 23): 2 participants, Rs. 240 bill, A paid 240, B paid 0', () => {
  const participants = [
    { id: 'A', name: 'A', shareAmount: 120, paidAmount: 240 },
    { id: 'B', name: 'B', shareAmount: 120, paidAmount: 0 },
  ];

  const settlement = calculateSettlement(participants);

  // MUST NOT show 0 transfers!
  assert.equal(settlement.transfers.length, 1);
  assert.equal(settlement.transfers[0].fromParticipantId, 'B');
  assert.equal(settlement.transfers[0].toParticipantId, 'A');
  assert.equal(settlement.transfers[0].amount, 120);

  // Initial state: 0 payments
  const enriched0 = enrichSettlementWithPayments(settlement.transfers, []);
  assert.equal(enriched0.transfers[0].dueAmount, 120);
  assert.equal(enriched0.transfers[0].paidAmount, 0);
  assert.equal(enriched0.transfers[0].remainingAmount, 120);
  assert.equal(enriched0.transfers[0].status, 'UNPAID');
  assert.equal(enriched0.isFullySettled, false);

  // B pays A Rs. 50
  const payment50 = [{ fromParticipantId: 'B', toParticipantId: 'A', amountPaisa: 5000n }];
  const enriched50 = enrichSettlementWithPayments(settlement.transfers, payment50);
  assert.equal(enriched50.transfers[0].paidAmount, 50);
  assert.equal(enriched50.transfers[0].remainingAmount, 70);
  assert.equal(enriched50.transfers[0].status, 'PARTIAL');
  assert.equal(enriched50.isFullySettled, false);

  // B pays A remaining Rs. 70
  const paymentFinal = [
    ...payment50,
    { fromParticipantId: 'B', toParticipantId: 'A', amountPaisa: 7000n },
  ];
  const enrichedFinal = enrichSettlementWithPayments(settlement.transfers, paymentFinal);
  assert.equal(enrichedFinal.transfers[0].paidAmount, 120);
  assert.equal(enrichedFinal.transfers[0].remainingAmount, 0);
  assert.equal(enrichedFinal.transfers[0].status, 'PAID');
  assert.equal(enrichedFinal.isFullySettled, true);
});

test('Test Case 3 (Section 24): Multiple merchant payers (Rs. 1000 bill, 4 participants)', () => {
  const participants = [
    { id: 'A', name: 'A', shareAmount: 250, paidAmount: 250 },
    { id: 'B', name: 'B', shareAmount: 250, paidAmount: 500 },
    { id: 'C', name: 'C', shareAmount: 250, paidAmount: 0 },
    { id: 'D', name: 'D', shareAmount: 250, paidAmount: 250 },
  ];

  const settlement = calculateSettlement(participants);

  // Only C owes B Rs. 250
  assert.equal(settlement.transfers.length, 1);
  assert.equal(settlement.transfers[0].fromParticipantId, 'C');
  assert.equal(settlement.transfers[0].toParticipantId, 'B');
  assert.equal(settlement.transfers[0].amount, 250);

  // Participant net balances
  const partA = settlement.participants.find((p) => p.id === 'A');
  const partB = settlement.participants.find((p) => p.id === 'B');
  const partC = settlement.participants.find((p) => p.id === 'C');
  const partD = settlement.participants.find((p) => p.id === 'D');

  assert.equal(partA.netBalance, 0);
  assert.equal(partB.netBalance, 250);
  assert.equal(partC.netBalance, -250);
  assert.equal(partD.netBalance, 0);
});

test('Test Case 4: Overpayment prevention invariant calculation', () => {
  const transfers = [
    { fromParticipantId: 'B', toParticipantId: 'A', amount: 200, amountPaisa: 20000n },
  ];
  const payments = [
    { fromParticipantId: 'B', toParticipantId: 'A', amountPaisa: 10000n },
  ];

  const enriched = enrichSettlementWithPayments(transfers, payments);
  const remaining = enriched.transfers[0].remainingAmount;
  assert.equal(remaining, 100);

  // Attempting to pay 150 when remaining is 100 must be rejected
  const attemptAmount = 150;
  assert.ok(attemptAmount > remaining, '150 exceeds remaining balance of 100');
});
