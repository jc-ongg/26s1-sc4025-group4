# Architecture and API

## Architecture

Browser -> nginx/Vite same-origin /api proxy -> Express -> Prisma -> PostgreSQL with pgvector.

React and TypeScript provide one responsive frontend. Express provides one backend with cookie sessions and backend validation. PostgreSQL stores diner identity fixtures, inventory, Events, reservations, social records and local embeddings. Compose exposes only the web port to the LAN. Relative API URLs work on a phone. Photos, map data and the embedding model are bundled locally; initial builds require package/image/model downloads.

## Data model

| Entity             | Main fields and constraints                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| User               | Unique email, fixture credentials/verified demographics, optional dining area, suspension expiry; no merchant role |
| Session            | Random token, user ID, expiry; HTTP-only cookie                                                                    |
| Restaurant         | Venue details, local photo, coordinates and active flag                                                            |
| ReservationSlot    | Restaurant/time uniqueness, minimum, maximum table size, shared seat pool and EatTogether eligibility              |
| SlotAllocation     | ID, indexed slot ID, seats and exactly one unique Event/booking owner                                              |
| GroupDiningSession | Host, slot, title, preferences, maximum table size, state, Cutoff/Last Call metadata and Chat opening              |
| GroupDiningMember  | Unique Event/account, legacy party size, join time and private price acceptance                                    |
| Booking            | Unique optional Event ID, slot, owner, diner total, discount, state and per-diner history deletion                 |
| ReliabilityStrike  | Timestamped private reason; unique account/Event/reason                                                            |
| Notification       | Private account, optional Event, unique account/key, read time                                                     |
| DinerBlock         | Unique blocker/blocked pair; symmetric exclusion with silent storage                                               |
| EventMessage       | Event/member, plain text, time                                                                                     |
| EventFeedback      | Unique Event/account, private six-question feedback and attendance attestation                                     |
| SafetyReport       | Event, reporter, target, reason, pending status                                                                    |
| DiscoveryDecision  | Per-account save/skip decisions                                                                                    |

Pool availability is the pool size minus allocated seats. Event Capacity is bounded by the Event/table maximum and its own hold plus free seats. Slot locks serialize Event mutations, ordinary bookings and lifecycle transitions. Never trust a browser seat count. The maximum physical table size remains separate from aggregate inventory.

States: OPEN (Waiting for diners), CONFIRMED, LAST_CALL, PRICE_DECISION (Action needed), FULL_PRICE, CANCELLED and EXPIRED. FULL is retained for legacy rows. A pending shared booking is excluded from confirmed reservations. Requalification updates the same booking reference. Cutoff and full-price behaviour are specified in [EATTOGETHER_SCOPE.md](EATTOGETHER_SCOPE.md).

Each new member has one seat; legacy multi-diner records can shrink to one. Verified adults must match immutable preferences. Public Event serialization excludes birth dates, reliability, private price choices and history deletion IDs. Own Event/history access survives changed eligibility. Timestamps are stored in UTC and shown in Singapore time.

## API contract

| Method     | Path                          | Purpose                                                               |
| ---------- | ----------------------------- | --------------------------------------------------------------------- |
| GET        | /api/health                   | Database readiness                                                    |
| POST       | /api/auth/login               | Credential login and independent session                              |
| POST       | /api/auth/logout              | Revoke current session                                                |
| GET        | /api/auth/me                  | Safe current identity                                                 |
| GET        | /api/restaurants              | Venues, free seats and eligible Event IDs                             |
| GET        | /api/restaurants/:id          | Details, future slots and eligible Events                             |
| GET        | /api/groups                   | Eligible future Events                                                |
| POST       | /api/groups                   | Hold minimum seats; enforce Join-before-create                        |
| GET        | /api/groups/:id               | Reconciled detail and public participants                             |
| POST       | /api/groups/:id/join          | One seat, eligibility and inventory checks                            |
| POST       | /api/groups/:id/resize        | Explicit legacy reduction to one seat                                 |
| POST       | /api/groups/:id/leave         | Departure, warning acknowledgement and Handover                       |
| POST       | /api/groups/:id/confirm       | Legacy reconciliation; cannot force qualification                     |
| POST       | /api/groups/:id/cancel        | Host cancellation and inventory release                               |
| POST       | /api/groups/:id/accept-price  | Accept own full-price choice                                          |
| POST       | /api/groups/:id/decline-price | Decline own choice without penalty                                    |
| GET / POST | /api/groups/:id/messages      | Member Chat, latest 200 messages, plain text                          |
| GET / POST | /api/groups/:id/feedback      | Own private post-time attested feedback                               |
| POST       | /api/groups/:id/safety        | Private report or silent block                                        |
| GET        | /api/me/profile               | Own safe demographics, rolling strikes and suspension                 |
| POST       | /api/me/profile               | Optional local dining area; blank clears                              |
| GET        | /api/me/notifications         | Eligible private inbox, latest 100 records                            |
| POST       | /api/me/notifications/read    | Read own notice or all own notices                                    |
| GET        | /api/me/blocks                | Own block list                                                        |
| POST       | /api/me/blocks/:id/remove     | Remove own block                                                      |
| GET        | /api/me/groups                | Own hosted/joined Events                                              |
| GET        | /api/me/bookings              | Own confirmed/cancelled ordinary and shared records                   |
| POST       | /api/bookings                 | Ordinary reservation drawing from shared inventory                    |
| POST       | /api/bookings/:id/cancel      | Owner cancellation                                                    |
| POST       | /api/bookings/:id/delete      | Personal removal of cancelled history                                 |
| POST       | /api/discovery/search         | Local ranking with explicit eligibility/cuisine/location/availability |
| POST       | /api/discovery/decision       | Save, skip or undo                                                    |
| GET        | /api/discovery/saved          | Current account shortlist                                             |

Dining middleware authenticates all downstream diner/discovery/social routes. Malformed requests return 400; missing login 401; forbidden actions 403; hidden/unknown resources 404; inventory/timing conflicts 409. JSON errors use readable messages. A 30-second lifecycle worker catches up after restart; detail reads and mutations reconcile under the slot lock. Vanished maintenance/fixture rows are skipped, while unexpected worker failures are logged.

## Verification and scope

See [TESTING.md](TESTING.md) for commands/evidence and [CI_CD.md](CI_CD.md) for GitHub checks and manual self-hosted deployment. [DISCOVERY.md](DISCOVERY.md) describes local ranking. [EATTOGETHER_SCOPE.md](EATTOGETHER_SCOPE.md) defines the implemented diner rules and limits.

Restaurant management, Restaurant Events, Corppass, attendance evidence/no-show penalties, real identity-provider authentication and moderation workflows remain deferred. The report Word document and diagrams stay unchanged until the team's product scope is finalized.
