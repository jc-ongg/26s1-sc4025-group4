# Architecture and API

## Architecture

Browser -> nginx/Vite same-origin /api proxy -> Express -> Prisma -> PostgreSQL with pgvector.

React and TypeScript provide one responsive frontend. Express provides one backend with cookie sessions and backend validation. PostgreSQL stores diner identity fixtures, inventory, Events, reservations, social records and local embeddings. Compose exposes only the web port to the LAN. Relative API URLs work on a phone. Photos, map data and the embedding model are bundled locally; initial builds require package/image/model downloads.

## Data model

| Entity             | Main fields and constraints                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| User               | Unique email, demo credentials, diner or business account type, optional managed venue, and diner profile fields |
| Session            | Random token, user ID, expiry; HTTP-only cookie                                                                  |
| Restaurant         | Venue details, local photo, coordinates, activation, EatTogether settings, and fixture verification              |
| ReservationSlot    | Restaurant/time uniqueness, minimum, maximum table size, shared seat pool and EatTogether eligibility            |
| SlotAllocation     | ID, indexed slot ID, seats and exactly one unique Event/booking owner                                            |
| GroupDiningSession | Host, slot, title, filters, capacity, state, optional restaurant theme and offer, and Cutoff/Last Call metadata  |
| GroupDiningMember  | Unique Event/account, legacy party size, join time, private price acceptance, and attendance                     |
| Booking            | Unique optional Event ID, slot, owner, diner total, discount, state and per-diner history deletion               |
| ReliabilityStrike  | Timestamped private reason; unique account/Event/reason                                                          |
| Notification       | Private account, optional Event, unique account/key, read time                                                   |
| DinerBlock         | Unique blocker/blocked pair; symmetric exclusion with silent storage                                             |
| EventMessage       | Event/member, plain text, time                                                                                   |
| EventFeedback      | Unique Event/account, private six-question feedback and attendance attestation                                   |
| SafetyReport       | Event, reporter, target, reason, pending status                                                                  |
| DiscoveryDecision  | Per-account save/skip decisions                                                                                  |

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

### Restaurant workspace

Routes under `/api/business` require a restaurant session. The server derives the managed venue from that account and scopes slots, reservations, and Events to the venue.

| Method     | Path                   | Purpose                                                         |
| ---------- | ---------------------- | --------------------------------------------------------------- |
| GET        | /dashboard             | Venue, slots, Events, and reservations for a Singapore date     |
| POST       | /settings              | Set venue-wide EatTogether availability                         |
| POST       | /slots/:id             | Edit a future slot with allocation safeguards                   |
| POST       | /events                | Create a Restaurant or Themed Event before Cutoff               |
| GET        | /events/:id            | View Event details, attendance, and eligible aggregate feedback |
| POST       | /events/:id/withdraw   | Withdraw an empty Restaurant Event before dining time           |
| POST       | /events/:id/attendance | Record or correct attendance from dining time onward            |
| GET / POST | /events/:id/messages   | Restaurant Host Chat once the Event has been confirmed          |

## Verification and scope

See [TESTING.md](TESTING.md) for commands/evidence and [CI_CD.md](CI_CD.md) for GitHub checks and manual self-hosted deployment. [DISCOVERY.md](DISCOVERY.md) describes local ranking. [EATTOGETHER_SCOPE.md](EATTOGETHER_SCOPE.md) defines the implemented diner rules and limits.

The restaurant workspace includes slot and reservation management, Restaurant and Themed Events, attendance, no-show penalties and aggregate Event Feedback. Real identity-provider authentication and moderation workflows remain deferred.
