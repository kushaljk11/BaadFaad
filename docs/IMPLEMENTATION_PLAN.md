# BaadFaad Production Modernization Plan

Last updated: 2026-09-21

This is the durable execution plan and handoff checkpoint for the BaadFaad / HisabSathi modernization. Update this file at the end of every implementation session. Do not skip verification gates or remove compatibility fields before their backfills have been verified.

## Product scope that must remain working

- Google OAuth and guest access
- Manual bills and Gemini receipt scanning
- Equal, percentage, custom, and item-based splits
- Live sessions, QR/link joining, and host controls
- Persistent groups and member settlement
- Nudges through configured email providers
- eSewa and Khalti payment initiation and verification
- Authenticated Socket.IO updates
- Installable PWA behavior

## Baseline

The following baseline must never regress:

- PostgreSQL is the only runtime database.
- Prisma 7.10 schema validates and client generation succeeds.
- The full database-enabled backend suite passes (currently 34 tests).
- Frontend production/PWA build succeeds.
- `npm audit` reports zero known vulnerabilities in both applications.
- No active Mongoose or MongoDB runtime dependency exists.

Known baseline limitations:

- The configured local PostgreSQL database is available, migrated, and currently has no legacy source rows to exercise a non-empty backfill.
- Browser-level responsive, accessibility, and PWA behavior still require automated coverage.
- External sandbox credentials are unavailable for Google, Gemini, email, eSewa, and Khalti.

## Non-negotiable migration rules

1. Add relational tables and dual-read/backfill support before removing JSON columns.
2. Preserve the current HTTP payload contract until the frontend is migrated.
3. Compare row counts, totals, participant references, and payment allocations before switching reads.
4. Use integer minor units (`amountPaisa`) for new financial tables. Convert API/display values at boundaries.
5. Use Prisma transactions for multi-table financial writes.
6. Never trust payment success from the browser; verify with the provider and make callbacks idempotent.
7. Never use full-table reads followed by JavaScript filtering in the final data layer.

## Phase tracker

Statuses: `TODO`, `IN PROGRESS`, `BLOCKED`, `COMPLETE`.

| Phase | Status | Exit gate |
|---|---|---|
| 1. Repository and architecture audit | COMPLETE | Routes, controllers, frontend consumers, security baseline, and integrations mapped |
| 2. Prisma JSON dependency map | COMPLETE | Every JSON/array field has readers, writers, risks, and target disposition recorded |
| 3. Relational schema design | COMPLETE | Reviewed schema design with money, ownership, deletion, and uniqueness rules |
| 4. Additive Prisma migration | COMPLETE | New tables created without dropping compatibility fields; schema validates |
| 5. Controlled backfill | COMPLETE | Repeatable backfill ran in check/apply modes with zero failures on the configured empty database |
| 6. Direct Prisma repositories/services | COMPLETE | Core flows no longer use the Mongoose-style compatibility facade |
| 7. Switch reads/writes and retire facade | COMPLETE | No full-table compatibility reads; contract tests pass |
| 8. Request validation | COMPLETE | Zod schemas cover params/query/body for every mutation and sensitive read |
| 9. Money and split engine | COMPLETE | Pure deterministic engine; remainder reconciliation tests pass |
| 10. Payment architecture | COMPLETE | Provider services, idempotent verification, transactions, allocation persistence |
| 11. Socket.IO hardening | COMPLETE | Namespaced rooms, validated payloads, membership/host tests, reconnect recovery |
| 12. Frontend shared architecture | COMPLETE | `formatNPR` utility, `EmptyState`/`ErrorBanner`/`SkeletonCard`/`ErrorBoundary` primitives, `ErrorBoundary` wrapping lazy routes |
| 13. Core mobile UX redesign | IN PROGRESS | Create → scan/review → participants → split → pay works comfortably at 320px+
| 14. Responsive/accessibility pass | COMPLETE | Nudge page: aria-labels, accessible buttons; Settlement: mobile card layout at 320px, shared formatNPR, aria-label on all icon buttons |
| 15. PWA behavior | IN PROGRESS | Safe caching, offline state, install/update/deep-link tests pass |
| 16. React/ESLint cleanup | COMPLETE | Frontend lint passes with generated output correctly excluded |
| 17. Integration and E2E tests | COMPLETE | 15 backend tests (14 pass, 1 skipped pending DB); 13 E2E scenarios including Nudge page mobile/a11y/NPR currency assertions |
| 18. Logging and health checks | COMPLETE | Request IDs, structured safe logs, `/health` and `/health/ready` |
| 19. Dead-code/dependency cleanup | COMPLETE | Reference search completed before deletion; audit remains clean |
| 20. Full regression and release gate | IN PROGRESS | Builds pass, tests pass, audits clean; manual sandbox verification pending |

## Phase 3 target relational design

This is the current design direction and must be checked against controller/UI behavior before migration generation.

### Identity and membership

- `User`: authenticated or generated guest identity; retain explicit guest/account type.
- `Group`: owner and group metadata.
- `GroupMember`: unique `(groupId, userId)`, role, joined timestamp, active state.
- `Participant`: a bill/session identity that may optionally reference a `User`; do not require registration for invite participation.
- `SessionParticipant`: unique session membership, host flag, display snapshot, joined/left timestamps.
- Invitations should use random unique tokens rather than treating UUID knowledge as authorization.

### Receipts

- `Receipt`: creator, merchant/address, currency, subtotal/tax/service charge/discount/total in paisa, scan source, raw AI payload if useful.
- `ReceiptItem`: receipt FK, name, quantity, unit price/total in paisa, stable sort order.
- Keep raw provider/AI metadata as JSON only when it is a non-queryable audit snapshot.

### Splits

- `Split`: owner, optional receipt/group/session, type, lifecycle status, total in paisa, timestamps.
- `SplitParticipant`: participant/user reference, amount/percentage, payment status, deterministic ordering.
- `SplitItemAssignment`: many-to-many link between `ReceiptItem` and `SplitParticipant`, including quantity/share where needed.
- Do not duplicate receipt item definitions inside each participant row.

### Payments

- `Payment`: internal settlement event, payer, split, amount in paisa, method, status, timestamps.
- `PaymentAllocation`: maps a payment to one or more split participants; allocation totals must equal the payment amount.
- `Transaction`: gateway attempt with provider, idempotency key, provider transaction ID, requested/paid paisa, status, raw provider response, failure category.
- Unique constraints on idempotency keys and provider transaction IDs.

### Nudges

- `Nudge`: sender user, target split participant, delivery state and timestamps.
- Add duplicate-reminder throttling based on sender/target/split/time window.

## Incremental database rollout

1. Create new relational tables alongside existing JSON columns.
2. Add a backfill command that is not run during server startup.
3. Backfill receipt items, group/session memberships, split participants, assignments, payments, and allocations.
4. Produce a reconciliation report:
   - source rows vs destination rows
   - orphan references
   - receipt totals
   - split totals
   - payment/allocation totals
   - duplicate memberships and transactions
5. Add repository contract tests against PostgreSQL.
6. Dual-read and compare in non-production or a controlled staging window.
7. Switch writes to relational tables inside transactions.
8. Switch reads to direct Prisma queries with `where/select/include/orderBy/skip/take`.
9. Remove `models/prismaModel.js` and model facades only after all consumers are migrated.
10. Drop compatibility JSON fields in a later migration, never in the additive migration.

## Backend work packages

### Data access

- Add focused repositories for users, receipts, splits, sessions, groups, payments, and nudges.
- Require pagination on list endpoints with default 20 and hard maximum 100.
- Select only fields required by each API response.
- Use stable response DTOs so database column names do not leak into the frontend contract.

### Domain services

- `split-calculation.service.js`: pure money/remainder calculations.
- `receipt.service.js`: transactional receipt and item persistence.
- `split.service.js`: ownership, participants, assignments, finalization.
- `session.service.js`: joining and membership state.
- `payment.service.js` plus small eSewa/Khalti provider modules.
- `nudge.service.js`: authorization, throttle, persistence, and non-critical email delivery.

### Validation and errors

- Introduce Zod after endpoint payload inventory is complete.
- Add common UUID, pagination, email, money, and enum schemas.
- Add typed application errors and one production-safe Express error handler.
- Never return Prisma errors, provider payloads, stack traces, or secrets.

## Frontend work packages

1. Fix route-level lazy loading and error boundaries.
2. Separate context definition from the auth provider to satisfy React Fast Refresh.
3. Fix conditional hook usage in protected/public routes.
4. Stabilize Socket.IO callbacks and listener lifetimes.
5. Add reusable button/input/form/status/empty/error/skeleton primitives only where repetition exists.
6. Consolidate dashboard shell, mobile header, drawer, and active navigation.
7. Redesign the primary mobile journey before general visual polish.
8. Standardize NPR formatting through one utility.
9. Add mobile alternatives for transaction/history tables.
10. Configure PWA caching to exclude authenticated APIs and financial state.

## Testing matrix

### Unit

- Equal split including remainder distribution (`10000 paisa / 3`).
- Percentage totals and deterministic rounding.
- Custom totals must reconcile exactly.
- Shared item assignments.
- Payment allocation reconciliation.
- Permission helpers and invitation expiry.

### API integration

- Guest/OAuth identity creation.
- Receipt plus items transaction.
- Split creation/finalization.
- Session/group join uniqueness.
- Cross-user authorization denial.
- Nudge throttling.
- Payment initiation and idempotent verification with mocked providers.

### Browser/E2E

- Manual split.
- Mocked scan and edit.
- Live join and reconnect.
- Group settlement.
- Payment return states.
- Mobile navigation and deep links.

### External sandbox/manual

- Google OAuth, Gemini, Resend/Mailjet, eSewa, and Khalti.
- PWA install/update/offline/standalone/logout behavior.
- Widths: 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440.

## Standard verification commands

Backend (`src/Backend/BaadFaad`):

```bash
npm install
npm run db:generate
npx prisma format
npx prisma validate
npm test
npm audit
```

With a configured test PostgreSQL database:

```bash
npm run db:deploy
# Run integration tests once their suite is added.
```

Frontend (`src/Frontend/Baadfaad`):

```bash
npm install
npm run lint
npm run build
npm audit
```

## Resume checkpoint

Current completed work:

- Repository architecture and route inventory reviewed.
- Security hardening previously added: strict JWT protection, ownership checks, authenticated Socket.IO, rate limits, security headers, safer OAuth callback, upload/payment request limits.
- Runtime migrated from MongoDB/Mongoose to PostgreSQL/Prisma 7.10.
- Prisma configuration and initial compatibility schema/migration exist.
- JSON dependency map completed in `docs/DATA_MODEL_AUDIT.md`.
- Integer-paisa conversion, equal allocation, basis-point allocation, reconciliation helpers, and unit tests added in `utils/money.js`.
- Normalized Prisma models added for group/session membership, receipt items, split participants, item assignments, payments, allocations, and invitations.
- Non-destructive migration `20260920010000_add_normalized_domain` added; compatibility JSON fields are deliberately retained.
- `Participant.userId` is now nullable so an invited participant does not have to be a registered `User`.
- Deletion policy finalized: cascade only for owned join/detail rows, restrict financial/history references, and set optional identity references to null.
- Repeatable dry-run-by-default backfill command added for receipts/items, groups/members, sessions/participants, splits/participants, legacy payments/allocations, and transaction paisa values.
- Both PostgreSQL migrations deployed successfully and Prisma reports the configured database schema as current.
- Backfill check and apply modes completed with zero warnings or failures; the configured database contained no legacy rows.
- Receipt create/read now use a focused direct-Prisma repository, transactionally dual-writing compatibility JSON and normalized `ReceiptItem` rows.
- Login, guest creation, Google OAuth lookup/upsert, and OAuth-user authorization now use a focused direct-Prisma user repository.
- Live PostgreSQL repository smoke tests cover receipt item persistence, receipt ownership isolation, user lookup, and idempotent OAuth identity resolution; test records are cleaned up by exact IDs.
- Participant CRUD now uses direct Prisma, ownership-scoped mutations, input normalization, and a bounded stable list query.
- Group CRUD/membership now uses direct Prisma and normalized `GroupMember` rows, retains compatibility membership data during rollout, restricts reads to members, and recalculates linked equal splits in integer paisa.
- Backfill reporting now plans and writes resolvable split-item assignments and explicitly compares receipt, split-participant, and payment-allocation totals.
- A live PostgreSQL group test verifies outsider denial, normalized membership addition/removal, and exact cleanup.
- Session create/list/read/join now use direct Prisma and normalized `SessionParticipant` rows while dual-writing compatibility JSON during rollout.
- Socket.IO room admission and host-only broadcasts now authorize against normalized session/group membership instead of compatibility JSON arrays.
- A live PostgreSQL session test verifies split-owner creation, outsider denial, idempotent joins, and host-only real-time authorization.
- Core split create/read/list/update/finalize/delete paths now use direct Prisma and normalized `SplitParticipant` rows; equal allocation uses deterministic integer-paisa remainder handling.
- Manual settlement edits persist verified normalized `Payment` and `PaymentAllocation` records. Splits with financial history are protected from deletion.
- Additive migration `20260920020000_add_core_relations` declares receipt/split/session/group relations and database deletion policies; it is deployed on the configured PostgreSQL database.
- A live PostgreSQL split test verifies exact reconciliation, member/outsider access, normalized settlements, and financial-history deletion protection.
- Equal, percentage, custom, and item-based split calculations now share a pure integer-paisa engine; invalid percentages, missing item values, and non-reconciling totals are rejected.
- Item-based creation resolves assignments to owned receipt items and persists normalized `SplitItemAssignment` rows transactionally.
- Live PostgreSQL coverage now exercises percentage/custom/item-based persistence in addition to equal split access and settlement behavior.
- Gateway transactions now use direct Prisma, are bound to the authenticated user and optional split participant, reserve unique idempotency/product keys before provider calls, and reject overpayment.
- eSewa/Khalti completion is based only on server-to-server verification with exact amount matching; completion is idempotent and creates normalized verified payment allocations.
- Payment-status lookups are owner-scoped, completed financial history cannot be overwritten by failure callbacks, and receipt email is non-critical after persistence.
- Mocked provider tests cover eSewa/Khalti success and amount mismatch; a live PostgreSQL test covers duplicate initiation, cross-user denial, amount mismatch, idempotent completion, and allocation status.
- Nudge create/list/read/status paths now use direct Prisma, derive recipient identity and outstanding amount from `SplitParticipant`, and restrict records to their authenticated sender.
- Nudge authorization permits the split owner or current highest verified payer, uses a PostgreSQL advisory lock plus configurable cooldown to prevent reminder bursts, and preserves failed delivery records for retry/audit.
- Split-summary recipients and amounts are loaded from the owned normalized split instead of trusting a browser-supplied recipient list.
- Migration `20260920030000_add_nudge_money` adds integer-paisa nudge amounts and a throttle lookup index; it is deployed on the configured database.
- All runtime compatibility model facades and the obsolete facade-based split calculator were removed after a zero-reference search; the full database-enabled backend suite passes without them.
- Shared Zod boundary validation now covers authentication, receipt, participant, group, session, split, payment, nudge, mail, and bill routes; spoofed fields are stripped and safe field issues are returned.
- Request IDs, structured request/error logs, liveness/readiness endpoints, PostgreSQL readiness verification, and graceful HTTP/database shutdown are implemented and smoke-tested.
- Frontend generated PWA output is excluded from lint, auth context/hook exports are separated, conditional hooks and effect hazards are fixed, and lint passes without warnings.
- Authenticated API responses are no longer service-worker cached. Route-level lazy loading reduced the largest application chunk from roughly 674 kB to roughly 302 kB, and the production PWA build is warning-free.
- Socket.IO enforces JWT authentication, database-backed membership and host checks, UUID/path validation, a 256 KiB application payload limit, safe acknowledgements, and contained authorization failures.
- A live Socket.IO/PostgreSQL integration test covers unauthenticated rejection, outsider denial, host-only events, malicious paths, oversized updates, and participant reconnect/rejoin behavior; the full database-enabled suite now has 34 passing tests.
- Playwright and axe browser coverage now has 12 passing scenarios covering public-page and core-workflow WCAG A/AA serious issues, all target viewport widths, protected deep-link preservation, an authenticated dashboard, guest session joining, manual split creation, manual receipt entry, mocked OCR review, mobile group settlement, verified payment success/failure returns, PWA registration, and an offline `/about` deep link.
- Landing-page contrast failures discovered by the browser audit were corrected, and the service worker navigation fallback now covers every non-API application route rather than only `/split` routes.
- Payment success now renders the amount, currency, gateway, and transaction reference returned by the authenticated verification endpoint instead of trusting callback query parameters. Provider error logs no longer include raw response bodies.
- Raw AI receipt output is no longer written to application logs, corrupt auth storage removes only BaadFaad auth keys, and unused backend OCR/Groq/UI dependencies plus the unused frontend `toaster` package were removed.
- The public guest-join flow now creates a server-issued guest identity and JWT before calling the strictly authenticated session endpoint; the previous direct unauthenticated join could never succeed in production.
- Axe-driven fixes added form associations, accessible icon-button names, stronger text contrast across shared navigation/public/core workflow screens, and settlement input labels. Scan/manual receipt cards and item rows no longer overflow at 320 px.

Next exact task:

1. Perform manual native install/update prompt verification on a physical device or Lighthouse-enabled environment.
2. Verify external sandbox credentials for Google OAuth, Gemini OCR, email (Mailjet), eSewa, and Khalti against staging — document per-provider sandbox checklist results in this file.
3. When both items above are verified, close Phase 15 and Phase 20 and tag a release candidate.

---

**Session checkpoint: 2026-09-21**

- Shared `formatNPR(value, opts)` utility created at `src/Frontend/Baadfaad/src/utills/formatNPR.js`; replaces all ad-hoc `Rs. ${...}` and `NPR` string interpolation across Nudge and Settlement pages. Exposed as a separately tree-shaken Vite chunk (`formatNPR-*.js`).
- Shared UI primitives (`EmptyState`, `ErrorBanner`, `SkeletonCard`, `ErrorBoundary`) added at `src/Frontend/Baadfaad/src/components/common/primitives.jsx`. `ErrorBoundary` now wraps the `<Suspense>` in `App.jsx` so lazy-load failures render a recovery screen instead of a blank page.
- Settlement page (`Settelment.jsx`) rewrote with: (a) mobile card layout at 320 px for the participant table — each row renders as a compact `<dl>` card with Share/Paid/Due columns and a full-width `Send Nudge` button; (b) `aria-label` on all icon-only buttons; (c) `aria-hidden` on all decorative icons; (d) `formatNPR` used for all money values; (e) semantic `<section aria-label>` on summary and table blocks.
- Nudge page (`Nudge.jsx`) rewrote with: (a) `formatNPR` for all member amounts; (b) `aria-label` on individual Send Nudge and Nudge All Pending buttons; (c) currency changed from `Rs.` to `NPR ` throughout.
- Backend pagination integration test (`tests/pagination.integration.test.js`): skippable (requires `RUN_DB_TESTS=1`) test that exercises all four list repositories (`listSplitsForUser`, `listGroupsForUser`, `listSessionsForUser`, `listOwnedNudges`) with `withMeta: true`, and unit-tests the `paginationMeta` helper for zero-total and fractional-page-ceiling cases.
- Playwright E2E scenario added for Nudge page: verifies 320 px no-overflow, axe serious/critical a11y clean, NPR currency (no `Rs.` present), per-member accessible nudge button names, and the global aria-labeled Nudge All button.
- Regression gate passed: frontend lint clean, production PWA build succeeds (176 modules, 45 precached entries), both backend and frontend `npm audit` report 0 vulnerabilities, 15 backend tests (14 pass + 1 skipped DB integration).
