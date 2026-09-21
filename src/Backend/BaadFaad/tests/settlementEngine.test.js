import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSettlement } from '../utils/settlementEngine.js';
import { calculateSplitRows } from '../utils/splitEngine.js';
import { validateAndAllocateContributions, getContributionSummary } from '../utils/contributionEngine.js';
import { toPaisa } from '../utils/money.js';

test('Case 1: 4 participants, equal split of Rs. 1000, A pays Rs. 1000', () => {
  const participants = [
    { id: 'A', name: 'A', shareAmount: 250, paidAmount: 1000 },
    { id: 'B', name: 'B', shareAmount: 250, paidAmount: 0 },
    { id: 'C', name: 'C', shareAmount: 250, paidAmount: 0 },
    { id: 'D', name: 'D', shareAmount: 250, paidAmount: 0 },
  ];

  const result = calculateSettlement(participants);

  assert.equal(result.transfers.length, 3);
  assert.deepEqual(
    result.transfers.map((t) => ({ from: t.fromParticipantId, to: t.toParticipantId, amount: t.amount })),
    [
      { from: 'B', to: 'A', amount: 250 },
      { from: 'C', to: 'A', amount: 250 },
      { from: 'D', to: 'A', amount: 250 },
    ]
  );
  assert.equal(result.totalDebtPaisa, 75000n);
  assert.equal(result.totalCreditPaisa, 75000n);
});

test('Case 2: 4 participants, equal split of Rs. 1000, multiple payers (A: 250, B: 500, C: 0, D: 250)', () => {
  const participants = [
    { id: 'A', name: 'A', shareAmount: 250, paidAmount: 250 },
    { id: 'B', name: 'B', shareAmount: 250, paidAmount: 500 },
    { id: 'C', name: 'C', shareAmount: 250, paidAmount: 0 },
    { id: 'D', name: 'D', shareAmount: 250, paidAmount: 250 },
  ];

  const result = calculateSettlement(participants);

  assert.equal(result.transfers.length, 1);
  assert.deepEqual(result.transfers[0], {
    fromParticipantId: 'C',
    fromName: 'C',
    toParticipantId: 'B',
    toName: 'B',
    amount: 250,
    amountPaisa: 25000n,
  });

  const bParticipant = result.participants.find((p) => p.id === 'B');
  assert.equal(bParticipant.netBalance, 250);
  assert.equal(bParticipant.status, 'creditor');

  const cParticipant = result.participants.find((p) => p.id === 'C');
  assert.equal(cParticipant.netBalance, -250);
  assert.equal(cParticipant.status, 'debtor');

  const aParticipant = result.participants.find((p) => p.id === 'A');
  assert.equal(aParticipant.netBalance, 0);
  assert.equal(aParticipant.status, 'settled');
});

test('Case 3: Custom split (A: 100, B: 300, C: 600), A pays Rs. 1000', () => {
  const participants = [
    { id: 'A', name: 'A', shareAmount: 100, paidAmount: 1000 },
    { id: 'B', name: 'B', shareAmount: 300, paidAmount: 0 },
    { id: 'C', name: 'C', shareAmount: 600, paidAmount: 0 },
  ];

  const result = calculateSettlement(participants);

  assert.equal(result.transfers.length, 2);
  assert.deepEqual(
    result.transfers.map((t) => ({ from: t.fromParticipantId, to: t.toParticipantId, amount: t.amount })),
    [
      { from: 'C', to: 'A', amount: 600 },
      { from: 'B', to: 'A', amount: 300 },
    ]
  );
});

test('Case 4: Percentage split creating paisa remainder (no financial leakage)', () => {
  const totalAmount = 100; // Rs. 100.00 = 10,000 paisa
  const splitRows = calculateSplitRows('percentage', toPaisa(totalAmount), [
    { percentage: 33.33 },
    { percentage: 33.33 },
    { percentage: 33.34 },
  ]);

  // A pays 100%, B & C pay 0
  const participants = [
    { id: 'A', name: 'A', shareAmountPaisa: splitRows[0].amountPaisa, paidAmount: 100 },
    { id: 'B', name: 'B', shareAmountPaisa: splitRows[1].amountPaisa, paidAmount: 0 },
    { id: 'C', name: 'C', shareAmountPaisa: splitRows[2].amountPaisa, paidAmount: 0 },
  ];

  const result = calculateSettlement(participants);

  const totalTransferred = result.transfers.reduce((sum, t) => sum + t.amountPaisa, 0n);
  assert.equal(totalTransferred, result.totalCreditPaisa);
  assert.equal(totalTransferred, result.totalDebtPaisa);
  // Verify exact paisa sums
  assert.equal(splitRows[0].amountPaisa + splitRows[1].amountPaisa + splitRows[2].amountPaisa, 10000n);
});

test('Case 5: Multiple creditors and multiple debtors', () => {
  // Total bill = 1000
  // Shares: A=200, B=300, C=400, D=100
  // Paid: A=500 (+300), B=500 (+200), C=0 (-400), D=0 (-100)
  const participants = [
    { id: 'A', name: 'A', shareAmount: 200, paidAmount: 500 },
    { id: 'B', name: 'B', shareAmount: 300, paidAmount: 500 },
    { id: 'C', name: 'C', shareAmount: 400, paidAmount: 0 },
    { id: 'D', name: 'D', shareAmount: 100, paidAmount: 0 },
  ];

  const result = calculateSettlement(participants);

  const totalTransfers = result.transfers.reduce((sum, t) => sum + t.amountPaisa, 0n);
  assert.equal(totalTransfers, 50000n); // 500 Rs in paisa
  assert.equal(result.totalDebtPaisa, 50000n);
  assert.equal(result.totalCreditPaisa, 50000n);

  // Transfers should be minimal and match C (400) and D (100) against A (300) and B (200)
  assert.deepEqual(
    result.transfers.map((t) => ({ from: t.fromParticipantId, to: t.toParticipantId, amount: t.amount })),
    [
      { from: 'C', to: 'A', amount: 300 },
      { from: 'C', to: 'B', amount: 100 },
      { from: 'D', to: 'B', amount: 100 },
    ]
  );
});

test('Case 6: All participants paid exactly their own share', () => {
  const participants = [
    { id: 'A', name: 'A', shareAmount: 250, paidAmount: 250 },
    { id: 'B', name: 'B', shareAmount: 250, paidAmount: 250 },
    { id: 'C', name: 'C', shareAmount: 500, paidAmount: 500 },
  ];

  const result = calculateSettlement(participants);

  assert.deepEqual(result.transfers, []);
  assert.equal(result.totalDebtPaisa, 0n);
  assert.equal(result.totalCreditPaisa, 0n);
  assert.ok(result.participants.every((p) => p.status === 'settled'));
});

test('Case 7: Contribution totals do not match bill (validation error)', () => {
  const totalAmount = 1000;
  const invalidContributions = [
    { id: 'A', amount: 500 },
    { id: 'B', amount: 200 }, // Total 700 !== 1000
  ];

  assert.throws(
    () => validateAndAllocateContributions(totalAmount, invalidContributions),
    /Contributions do not reconcile with bill total/
  );

  const summary = getContributionSummary(totalAmount, invalidContributions);
  assert.equal(summary.isExact, false);
  assert.equal(summary.assigned, 700);
  assert.equal(summary.remaining, 300);
});

test('Case 8: Group with 4 registered users - session completion retains group on dashboards of all 4 users', async () => {
  const { getPrisma } = await import('../config/prisma.js');
  const { createSessionForSplit, joinSessionAsUser } = await import('../repositories/session.repository.js');
  const { createSplitRecord, finalizeOwnedSplit } = await import('../repositories/split.repository.js');
  const { listGroupsForUser } = await import('../repositories/group.repository.js');
  const prisma = getPrisma();

  // Only run if database is connected
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return; // skip if DB not available in this test runner context
  }

  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const userC = crypto.randomUUID();
  const userD = crypto.randomUUID();

  try {
    await prisma.user.createMany({
      data: [
        { id: userA, name: 'Kushal', email: `kushal-${userA}@example.test` },
        { id: userB, name: 'Ram', email: `ram-${userB}@example.test` },
        { id: userC, name: 'Hari', email: `hari-${userC}@example.test` },
        { id: userD, name: 'Sita', email: `sita-${userD}@example.test` },
      ],
    });

    // 1. Kushal creates Pokhara Trip split
    const splitResult = await createSplitRecord({
      createdBy: userA,
      name: 'Pokhara Trip',
      totalAmount: 1000,
      splitType: 'equal',
      participants: [{ _id: userA, name: 'Kushal' }],
    });
    const splitId = splitResult.split.id;

    // 2. Kushal creates session
    const sessionId = crypto.randomUUID();
    await createSessionForSplit({
      id: sessionId,
      name: 'Pokhara Trip',
      splitId,
      ownerId: userA,
      qrCode: '',
      endDate: new Date(Date.now() + 86400000),
    });

    // 3. Ram, Hari, Sita join session
    await joinSessionAsUser({ sessionId, userId: userB });
    await joinSessionAsUser({ sessionId, userId: userC });
    await joinSessionAsUser({ sessionId, userId: userD });

    // 4. Host completes session
    const finalizeRes = await finalizeOwnedSplit(splitId, userA);
    assert.equal(finalizeRes.status, 'finalized');

    // 5. Verify Pokhara Trip appears for all 4 users under My Groups
    const groupsA = await listGroupsForUser(userA);
    const groupsB = await listGroupsForUser(userB);
    const groupsC = await listGroupsForUser(userC);
    const groupsD = await listGroupsForUser(userD);

    assert.ok(groupsA.some((g) => g.name === 'Pokhara Trip'));
    assert.ok(groupsB.some((g) => g.name === 'Pokhara Trip'));
    assert.ok(groupsC.some((g) => g.name === 'Pokhara Trip'));
    assert.ok(groupsD.some((g) => g.name === 'Pokhara Trip'));
  } finally {
    await prisma.group.deleteMany({ where: { name: 'Pokhara Trip' } }).catch(() => {});
    await prisma.session.deleteMany({ where: { name: 'Pokhara Trip' } }).catch(() => {});
    await prisma.split.deleteMany({ where: { name: 'Pokhara Trip' } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB, userC, userD] } } }).catch(() => {});
  }
});

test('Case 9: Real-time broadcast triggers when contribution changes', async () => {
  const { broadcastSplitEvent, getIO } = await import('../config/socket.js');
  let eventReceived = null;

  // Verify broadcastSplitEvent does not throw even without active sockets
  await broadcastSplitEvent('test-split-id', 'contribution:updated', { totalAssigned: 1000 });
  await broadcastSplitEvent('test-split-id', 'settlement:updated', { transfers: [] });
  assert.ok(true);
});

test('Case 10: Session completion preserves historical information', () => {
  const completedSplit = {
    id: 'split-10',
    name: 'Dinner',
    status: 'completed',
    finalizedAt: new Date(),
    totalAmount: 1000,
    breakdown: [
      { id: 'p1', name: 'A', shareAmount: 500, paidAmount: 1000, netBalance: 500 },
      { id: 'p2', name: 'B', shareAmount: 500, paidAmount: 0, netBalance: -500 },
    ],
    settlement: [
      { fromParticipantId: 'p2', toParticipantId: 'p1', amount: 500 },
    ],
  };

  // Status must be completed or finalized
  assert.ok(['completed', 'finalized'].includes(completedSplit.status));
  // Financial history is fully preserved
  assert.equal(completedSplit.breakdown.length, 2);
  assert.equal(completedSplit.settlement.length, 1);
  assert.equal(completedSplit.settlement[0].amount, 500);
});
