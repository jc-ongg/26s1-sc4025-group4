# Architecture and API

## Architecture

Browser -> frontend server on port 3000 -> same-origin /api proxy -> Express -> Prisma -> PostgreSQL.

React and TypeScript with Vite provide the responsive frontend. Express and TypeScript provide one backend. PostgreSQL stores accounts, sessions, inventory, groups, and bookings. Prisma manages the schema and migrations. Docker Compose runs all services with a persistent database volume. Only the web port is exposed to the LAN. All runtime assets are local. Initial image/package downloads require internet.

The frontend calls relative /api URLs, so phones do not accidentally call their own localhost. Development uses Vite's proxy; the packaged demo uses nginx. The API binds to 0.0.0.0 inside Docker.

## Data model

| Entity             | Main fields and constraints                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| User               | id, unique email, name, demo password; no role                                       |
| Session            | random token, userId, expiresAt; HTTP-only cookie                                    |
| Restaurant         | id, name, cuisine, area, description, local image, latitude, longitude               |
| ReservationSlot    | id, restaurantId, startsAt, minimumPartySize, capacity, discount                     |
| SlotAllocation     | unique slotId, allocation owner; exclusive hold shared by normal bookings and groups |
| GroupDiningSession | id, hostId, slotId, title, description, capacity, status, createdAt                  |
| GroupDiningMember  | groupId, userId, joinedAt; unique groupId/userId                                     |
| Booking            | id, slotId, userId, optional unique groupId, partySize, status, createdAt            |

Authentication, restaurant, inventory, group and booking tables are implemented. See TESTING.md for verification commands and coverage.

Group states: OPEN, FULL, CONFIRMED, CANCELLED, EXPIRED. FULL is still unconfirmed and permits member departure. Leaving a full group restores OPEN. Confirmation requires the host, a future slot, the minimum party size, and a valid allocation. Capacity cannot exceed the slot's capacity or fall below its minimum.

Mutations must be atomic: lock the slot/group row within a database transaction, recheck status and capacity, then update membership/allocation/booking. Unique constraints prevent duplicate membership and multiple allocations. Cancellation and expiry release the allocation in the same transaction. Repeat requests must not create duplicate bookings. Never rely on frontend seat counts for enforcement.

Store timestamps in UTC; display dining times in Asia/Singapore. Validate input and ownership on the backend.

## API contract

| Method | Path                     | Purpose                                            |
| ------ | ------------------------ | -------------------------------------------------- |
| GET    | /api/health              | Database-backed readiness                          |
| POST   | /api/auth/login          | Match seeded email/password and issue session      |
| POST   | /api/auth/logout         | Delete current session and clear cookie            |
| GET    | /api/auth/me             | Current identity                                   |
| GET    | /api/restaurants         | Browse/filter restaurants                          |
| GET    | /api/restaurants/:id     | Details and future slots                           |
| GET    | /api/groups              | Discover groups with occupancy and host            |
| POST   | /api/groups              | Create group and acquire slot hold                 |
| GET    | /api/groups/:id          | Details and participants                           |
| POST   | /api/groups/:id/join     | Join once if capacity permits                      |
| POST   | /api/groups/:id/leave    | Leave an unconfirmed group                         |
| POST   | /api/groups/:id/confirm  | Host confirms and creates booking                  |
| POST   | /api/groups/:id/cancel   | Host cancels and releases inventory                |
| GET    | /api/me/groups           | Hosted and joined groups                           |
| GET    | /api/me/bookings         | Ordinary and shared confirmed bookings             |
| POST   | /api/bookings            | Ordinary booking with exclusive slot allocation    |
| POST   | /api/bookings/:id/cancel | Owner cancels an ordinary booking                  |
| POST   | /api/bookings/:id/delete | Remove a cancelled booking from personal history   |
| POST   | /api/discovery/search    | Rank eligible groups or restaurants by dining mood |
| POST   | /api/discovery/decision  | Save, skip or undo a card decision                 |
| GET    | /api/discovery/saved     | Current account shortlist                          |

Use 400 for malformed input, 401 for missing/expired login, 403 for unauthorized actions, 404 for missing resources, and 409 for capacity/inventory/state conflicts. Return JSON errors with a readable message. All listed endpoints are implemented.

## Feature coverage

1. Foundation: Compose, database migration, repeatable seed, backend credential login, frontend login/logout, persistent session, type checking and builds.
2. Shared group flow: browse restaurants, create group as Jacob, join as Alice from another session, refetch shared occupancy. Test concurrent last-seat joins and duplicate joins against PostgreSQL.
3. Booking lifecycle: minimum-size host confirmation, cancellation, leaving, slot allocation conflicts, expiry, ordinary booking, and personal booking views. Test non-host access and rollback paths.
4. Demo polish: local restaurant artwork, realistic future seed slots, populated group states, responsive pages, loading/error/empty states, polling, multi-device LAN walkthrough.
5. Semantic discovery: local MiniLM embeddings with pgvector ranking, explicit geographic/availability filters and per-account shortlists. See DISCOVERY.md for implementation details and evaluation limits.

## Engineering report evidence

Maintain architecture/data diagrams, feature-to-user-story mapping, test commands and actual results, reproducible demo steps, deployment instructions, and limitations. Cite research when justifying semantic retrieval. Keep proposed design distinct from implemented behavior.
