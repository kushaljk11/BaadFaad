# Prisma JSON and Compatibility-Layer Dependency Audit

Date: 2026-09-20

## Summary

The runtime is PostgreSQL/Prisma, but core domain state still mirrors the former MongoDB document layout. The compatibility facade in `src/Backend/BaadFaad/models/prismaModel.js` implements Mongoose-like `find`, `populate`, `save`, update operators, sorting, and filtering. Its `find()` calls Prisma `findMany()` with no database predicate and then filters/sorts in JavaScript. This must be retired incrementally because it is inefficient and prevents database-enforced relations.

## Approved relational decisions

- Money in new domain tables uses integer paisa (`BigInt`); percentages use integer basis points.
- `Participant.userId` is nullable because session invitees may exist without a registered account.
- Group and session authority is explicit (`role`, `isHost`) rather than inferred from array order.
- Child/detail rows cascade with their aggregate (`ReceiptItem`, membership rows, split rows); verified financial links use restrictive deletion; optional identity links use `SET NULL`.
- Invitation secrets are stored as hashes with expiry/revocation/use limits.
- Existing JSON fields remain during migration and will only be removed after backfill reconciliation and read/write cutover.

## Field map

| Current field | Shape and meaning | Main backend readers/writers | Frontend consumers | Decision |
|---|---|---|---|---|
| `Receipt.items Json` | User/AI line items: name, price, quantity | Receipt controller creates; split flow reads receipt total/items | ScanBill and split screens | Normalize to `ReceiptItem`; optionally retain raw AI response separately |
| `Split.breakdown Json` | User/participant share, amount paid, status, percentage, assigned items | Split controller creates/rebuilds/updates/finalizes; group join recalculates; payment allocation utility reads | SplitBreakdown, SplitCalculated, Settlement, Nudge | Normalize to `SplitParticipant` plus `SplitItemAssignment` |
| `Split.payments Json` | Payer plus allocations to participants | Split controller/payment-allocation utility reads and appends | Settlement and calculated views consume derived amounts | Normalize to `Payment` and `PaymentAllocation` |
| `Session.participants Json` | Joined user/participant/guest snapshots and order; first entry acts as host | Session controller joins/lists; Socket.IO authorizes rooms/host | ReadyToSplit, JoinedParticipants, breakdown screens | Normalize to `SessionParticipant`; store explicit `isHost`, never infer authority from array position |
| `Group.members String[]` | User IDs | Group controller membership CRUD; Socket.IO authorization; split membership reconciliation | Group, join, settlement, nudge and split pages | Normalize to `GroupMember` with unique composite constraint |
| `Transaction.customerDetails Json` | Name/email/phone snapshot used for gateway requests and receipt email | Payment controller creates and emails | Payment return UI indirectly | Keep immutable contact snapshot as JSON only if a normalized payer/user FK and safe explicit response fields are added |

## Receipt flow

Write path:

`ScanBill.jsx` → `POST /api/receipts` → `receipt.controller.createReceipt` → compatibility `Receipt.create`.

Read path:

Receipt is attached to a split and populated by split endpoints. Receipt items are not independently queryable, addressable, or constrained.

Risks:

- No item-level foreign keys or stable ordering constraint.
- Item totals are represented as floating-point numbers.
- AI data and confirmed user data are not clearly separated.
- Receipt creation and item creation cannot currently be transactional because items are embedded.

Target:

- `Receipt` with integer money columns and optional raw AI JSON.
- `ReceiptItem` rows created in one Prisma transaction.

## Split flow

Write paths:

- `createSplit` constructs an equal breakdown.
- `updateSplit` rebuilds breakdown from a session/group or accepts a manual override.
- `updateParticipantPayment` edits one array entry by index.
- `ensureSplitHasGroupMembers` replaces the entire breakdown.
- Group join recalculates and replaces the entire breakdown.
- `finalizeSplit` increments participant totals.

Read paths:

- Split list/detail endpoints.
- Settlement, calculated result, reminder summary, and allocation aggregation.
- Several frontend screens identify rows using a mixture of user ID, participant ID, breakdown `_id`, name, and email.

Risks:

- Index-based updates are concurrency-sensitive.
- Names/emails are used as historical identity fallbacks.
- Whole-array replacement can erase concurrent payment state.
- Float rounding can make allocations fail to reconcile.
- Item assignments duplicate item descriptions rather than reference receipt items.

Target:

- Stable `SplitParticipant.id` used by APIs.
- Explicit optional `userId`/`participantId`, snapshot name/email, amount paisa, basis points, status and sort order.
- `SplitItemAssignment` references receipt items and participants.
- All recalculation performed in a transaction with optimistic concurrency or a version check.

## Payment flow

Two concepts currently overlap:

- `Transaction` stores a gateway payment attempt.
- `Split.payments` stores settlement/allocation information.

Risks:

- Gateway transaction is not strongly related to split, payer, or allocation.
- JSON payment allocations are not constrained to equal the payment total.
- Provider status changes and settlement updates are not one atomic transaction.

Target:

- Gateway `Transaction` references payer and split/payment where available.
- `Payment` represents verified/manual settlement.
- `PaymentAllocation` distributes a payment across split participants.
- Provider verification and settlement writes are idempotent and transactional.

## Session flow

Write path:

Session creation stores the owner as the first JSON participant. Join uses a read/check/update sequence in the compatibility layer.

Read path:

Session APIs, Socket.IO membership authorization, host authorization, and live participant lists.

Risks:

- Host authority depends on array ordering.
- Compatibility update is not atomic, so simultaneous joins can duplicate membership.
- Membership cannot be indexed effectively.

Target:

- `SessionParticipant(sessionId, userId/participantId, isHost, joinedAt, leftAt)`.
- Unique constraints for registered identities and an explicit invite/guest identity strategy.

## Group flow

Write path:

Create embeds user IDs; join/add/remove replaces or mutates the array; group join also recalculates the linked split.

Read path:

Group list/detail, Socket.IO access, settlements, reminders and participant views.

Risks:

- Membership roles and history cannot be modeled.
- Array membership queries go through the full-table compatibility facade.
- Membership mutation and split recalculation are not one transaction.

Target:

- `GroupMember` with unique `(groupId, userId)`, role and timestamps.
- Transactional join/removal where split participant state must change.

## Compatibility facade consumers

All current model files delegate to `createModel()`:

- `userModel.js`
- `participant.model.js`
- `receipt.model.js`
- `split.model.js`
- `session.model.js`
- `group.model.js`
- `nudge.model.js`
- `payment.models.js`

Direct consumers include authentication/passport middleware, all domain controllers, Socket.IO authorization, and the split calculation utility. Replacement should be vertical by domain, not a single big-bang deletion.

Recommended order:

1. User/auth repository (simple, no JSON).
2. Receipt and receipt items.
3. Group/session membership.
4. Split participants and item assignments.
5. Payments and allocations.
6. Nudges and history pagination.
7. Remove facade/model wrappers after reference search returns zero consumers.
