# 5 MVP and Technical Implementation

The Eatigo prototype provides restaurant discovery and ordinary reservations, with EatTogether integrated into the same restaurant journey. EatTogether lets individual verified diners join a shared Event so that their combined party size can meet a restaurant slot's minimum party size. Local semantic discovery provides a separate way to find and shortlist restaurants from a dining preference. The implementation connects these journeys through shared inventory, authenticated accounts and persistent data.

This section describes the implemented system as at 11 October 2026, using application source snapshot dc360ad and the repository's recorded engineering checks. The Product Engineer is responsible for the frontend, backend, database, local deployment and verification. Sections 5.1 and 5.2 are reserved for the group's later hypothesis and development-approach discussion. Restaurant management, genuine identity verification and real restaurant inventory integration remain outside this implementation.

## 5.3 System Architecture and Technology Stack

The system uses a three-tier architecture: a React browser application, an Express application server and a PostgreSQL database. Docker Compose runs three containers on one host. Authentication, dining operations, Event lifecycle processing, social features and semantic discovery are separate backend modules within one deployable application. This modular monolith reduces the operational work for a single Product Engineer while keeping related business rules together.

Figure 5.1 shows the runtime boundaries. The frontend container serves compiled assets through Nginx and publishes host port 3000. Requests under /api are proxied to Express on port 4000 inside the Compose network. PostgreSQL is available only inside that network in the current configuration. The browser uses one origin for the interface and API, so a second device does not require a different backend address.

@figure architecture | Figure 5.1 Runtime architecture and deployment boundaries

The embedding model runs on CPU inside the backend process, rather than in a fourth container or a hosted inference service. Its files are downloaded during the image build; runtime remote model loading is disabled. PostgreSQL stores relational records and 384-dimensional vectors through pgvector. A lifecycle worker in the backend checks time-dependent Event rules every 30 seconds. Relevant requests also reconcile lifecycle state under the same locking convention, allowing the application to catch up after a restart.

### Technology choices

@table Table 5.1 Technology stack and implementation rationale
| Layer | Technology | Role and rationale |
|---|---|---|
| Browser interface | React 19 and TypeScript 5.9 | Reusable components and typed account, restaurant, Event and booking models. |
| Frontend build | Vite 7 and shared CSS | Production compilation and consistent responsive layouts without a large UI framework. |
| Web serving | Nginx | Local assets and a same-origin reverse proxy for /api. |
| Application server | Node.js 22 and Express 5 | JSON APIs, session checks and modular business rules in TypeScript. |
| Data access | Prisma 6 | Typed relational access, schema definition and versioned migrations. |
| Database | PostgreSQL 16 and pgvector 0.8.2 | Persistent inventory, participation and vectors in one database. |
| Embeddings | Transformers.js 3.8 and quantised MiniLM | Local CPU sentence embeddings for descriptive restaurant retrieval. |
| Map | Leaflet 1.9 and bundled GeoJSON | Restaurant locations over a local OpenStreetMap-derived extract. |
| Deployment | Docker Compose and PowerShell | Reproducible service startup and manual deployment of a tested source package. |
| Quality and delivery | Node test runner, Prettier and GitHub Actions | Automated checks, isolated integration tests and delivery artifacts. |

TypeScript is used on both sides of the API, although frontend response types are maintained separately rather than generated from an API specification. Prisma supplies typed access to ordinary relational fields. Vector fields are declared as unsupported database types in the Prisma schema and accessed through parameterised SQL. Versions in Table 5.1 describe project configuration, not a claim that they are the latest releases.

## 5.4 Application Design and API Boundaries

### Frontend organisation

The root component checks /api/auth/me to restore a session or show the login interface. Hash-based navigation identifies restaurant details, Event details, Profile and Bookings. The main discovery page contains one restaurant collection, avoiding duplicate restaurant and Event lists. Restaurant cards and map details expose the same related Events through a shared component. Each venue shows its upcoming Event count, and expanded Events can be inspected one at a time.

The collection supports text search, cuisine, price-band, minimum-discount and EatTogether-availability filters. The availability filter distinguishes any venue, venues with Events and venues with seats to Join. The heading displays both filtered restaurant and Event counts. List view displays at most three restaurant cards per page; map view uses one marker per restaurant, including when that venue has several Events. Price bands are catalogue categories, not calculated menu prices.

For you opens a restaurant-only discovery popup from the main page. Its mood and location fields begin empty; placeholders do not create a default request. My shortlist stays within that popup. Profile, Bookings and Logout are accessed through the account menu. Bookings displays Reservations on the left and EatTogether on the right at desktop widths, with two records per independently paginated list. Smaller screens stack the sections. Profile contains identity, settings, reliability information and notification history, without duplicating booking details.

Local React state handles inputs, pagination, view selection and temporary feedback. Server records remain authoritative. A shared resource hook polls relevant data every five seconds, avoids overlapping requests and ignores disposed responses. Refreshes retain existing content and selected Event identifiers where possible. This reduces flicker but does not provide instant synchronisation. A displayed seat may disappear before Join is submitted, so the backend always checks availability again.

### Backend responsibilities and authentication

Express configures request parsing, cookies, authentication and error handling. Authenticated dining and social endpoints derive the user from a server-side session; the browser cannot select another account by supplying its identifier. Mutations check ownership, membership, Event eligibility, start time and current inventory before changing data.

Six fictional diner accounts use seeded email identities and the shared password password123. Login normalises the email and compares it with the stored demonstration credentials. Successful login creates a random 32-byte token, stores a session with a 24-hour expiry, and sets an HttpOnly, SameSite=Lax cookie. Logout revokes the session. The password visibility control changes only how the entered password is displayed.

The fixtures represent already Singpass-verified adults, with fixed birth dates producing ages 21–26 in October 2026. Age is calculated using Singapore calendar dates; birth dates are not returned publicly. Login and registration include inactive Singpass options, and credential registration explains that verification is needed for some features. These controls are presentation only: there is no registration, password-reset or Singpass API integration. Example credentials are held in a separate text file rather than displayed as an account list on the login page.

All implemented accounts are diners. Hosting is an Event-specific relationship, not a permanent account type. A host can cancel their Event before dining, while a member can leave without controlling the entire Event. Automatic confirmation does not require a host-only confirmation action. Restaurant account permissions and a merchant interface are deferred.

### API contract

The application uses an HTTP JSON API under /api. Table 5.2 groups the main routes; it is a summary rather than a complete public API specification. The /groups paths retain the original implementation terminology, while the interface calls the shared gathering an EatTogether Event.

@table Table 5.2 Main API boundaries
| Method and path | Purpose | Key rule |
|---|---|---|
| GET /health | Check API and database readiness | Queries the database; does not prove the embedding model is warmed. |
| POST /auth/login; GET /auth/me; POST /auth/logout | Create, inspect and revoke a session | Identity comes from the validated session token. |
| GET /restaurants and /restaurants/:id | Retrieve venues, slots and related Events | Active venues and current slot availability are exposed. |
| POST /bookings | Create an ordinary reservation | Future slot, valid party size and sufficient pool seats are required. |
| GET /groups and /groups/:id | Retrieve eligible Events and details | Verification, demographic and blocking rules apply. |
| POST /groups; POST /groups/:id/:action | Create, Join, Leave, cancel or respond to price decisions | One seat per account; inventory and lifecycle are checked transactionally. |
| GET /me/bookings and /me/groups | Retrieve personal plans | Ownership or Event participation is required. |
| POST /bookings/:id/cancel or /delete | Cancel or personally hide a cancelled record | Shared history is preserved for other participants. |
| GET or POST /me/profile; /me/notifications routes | Profile settings and persistent notices | Private reliability and notifications belong to the current account. |
| /groups/:id/messages, /feedback and /safety | Chat, private feedback and safety reporting | Membership and lifecycle restrict access and submission. |
| POST /discovery/search and /decision; GET /discovery/saved | Rank restaurants and manage a shortlist | Cuisine constraints and per-account decisions are enforced. |

Malformed inputs return 400; unauthenticated requests return 401; prohibited actions return 403; unavailable or concealed records return 404; competing state changes can return 409. Model unavailability returns 503 rather than silently replacing semantic retrieval with a different algorithm. Client errors are therefore separated from business-rule conflicts and inference failures.

### External data boundaries

Eight restaurant examples and photographs were imported from public Eatigo branch pages, including Joya Onsen Cafe, Seorae Korean Charcoal BBQ, 2SCOOPS, il Cielo and Lime Restaurant. These are source snapshots. Slots, discounts, seat pools, accounts and Event activity are generated locally; confirmation is a prototype database operation, not a reservation accepted by a real restaurant.

Leaflet renders a bundled OpenStreetMap-derived extract covering western and central Singapore. There is no runtime tile provider, external geocoder, payment provider or Eatigo booking API. Typed discovery locations resolve against local neighbourhood and restaurant metadata. Asset provenance and attribution are retained in docs/SOURCES.md and the map notice. Initial downloads require network access; application inference and map rendering use local files after setup.

## 5.5 Data Model and Reservation Consistency

The model separates a restaurant, its time slots, Event participation and a booking. ReservationSlot is unique by restaurant and start time. Its capacity is the maximum size of one table or Event, while discountedSeats describes the aggregate seat pool for that slot. Multiple ordinary reservations and Events can allocate seats from that pool, subject to the individual table limit. The fallback pool size is capacity when discountedSeats is absent.

@figure data-model | Figure 5.2 Core relationships and shared seat allocations

@table Table 5.3 Main entities and constraints
| Entity | Important fields or key | Responsibility |
|---|---|---|
| User and Session | Unique email; verification, birth date and gender; token and expiry | Demo identity, eligibility and authenticated access. |
| Restaurant | Active flag, coordinates and vector(384) | Venue content, map position and semantic description. |
| ReservationSlot | Unique restaurant and start time; capacity and discountedSeats | Individual table limit and shared inventory pool. |
| SlotAllocation | ID primary key; indexed slotId; unique optional owner IDs | Seats held by exactly one Event or ordinary booking. |
| GroupDiningSession | hostId, slotId, status, immutable preferences and Cutoff fields | Event eligibility and lifecycle. |
| GroupDiningMember | Composite key of groupId and userId; priceAccepted | One membership per account and individual full-price decisions. |
| Booking | Optional unique groupId; status, discount and deletedFor | Ordinary reservation or one shared Event booking. |
| DiscoveryDecision | Composite userId and targetKey | Account-specific SAVE, SKIP and undo. |
| Social records | Notifications, strikes, blocks, messages, feedback and reports | Persistent private communication and safeguards. |

SlotAllocation has its own primary key, so one slot may have several allocations. A database CHECK constraint requires exactly one owner, either an Event or an ordinary booking. Each owner reference is unique. Available pool seats equal the pool limit minus the sum of held seats, never below zero. An Event initially holds its minimum-party-size requirement, even when only its host is present. Before Cutoff, its hold is the greater of that minimum and its current diner count; at Cutoff, unused held seats are released.

A confirmed Event has one Booking because groupId is unique on that model. Its allocation remains Event-owned, avoiding a second allocation for the same diners. If participation falls below the minimum before Cutoff, the booking becomes PENDING. Requalification updates the same booking reference rather than creating a duplicate. After Cutoff, full-price seats still consume inventory because diners continue to occupy a physical table.

### Transactions and competing requests

Inventory-changing operations lock the ReservationSlot row using SELECT FOR UPDATE inside a Prisma transaction before checking the current pool and memberships. All relevant paths, including lifecycle processing, use the same convention. PostgreSQL row locks make competing updates and locking operations wait until the transaction ends (PostgreSQL Global Development Group, n.d.).

For example, if only two pool seats remain and three diners Join concurrently, only two requests may succeed. The third must observe the updated allocations and receive a conflict. Ordinary bookings compete against Event creation and growth through the same pool, so neither path can rely on a stale display of availability. Database keys prevent duplicate membership and shared bookings; transaction logic enforces conditions spanning several rows.

Cancellation releases the corresponding allocation before returning success. A host leaving transfers the host relationship to the earliest remaining member and moves booking ownership accordingly. If the final member leaves, the Event is cancelled and its allocation released. An explicit host cancellation cancels the shared Event and booking together. Personal deletion of a cancelled booking adds the requesting account to deletedFor; it preserves the underlying record for other participants. Archived venues are also retained for historical references.

## 5.6 Functional MVP Implementation

### 5.6.1 Restaurant Discovery and Ordinary Reservations

The homepage combines a compact top-picks carousel with the restaurant collection, filters and list/map toggle. EatTogether is visible through venue counts and expandable Events, rather than a separate main tab. A venue with several Events retains one restaurant card and one map marker. Event selection is paginated within that venue, preventing repeated venue information.

Selecting a restaurant opens its time slots. Book is the default flow, with EatTogether available as an optional alternative. An ordinary reservation accepts a party size within the slot's minimum and table capacity, checks shared pool availability, and creates a confirmed booking. The one-account-one-seat rule applies to EatTogether participation; ordinary bookings retain their party-size selector.

Filters respect the selected booking route. For instance, a 50% ordinary offer cannot satisfy a 40% EatTogether filter if the Event offers only 30%. An explicit zero-discount Event is treated as full price, not replaced with the slot discount. Upcoming counts use future eligible Events at active venues; cancelled, expired and started Events are excluded. Full future Events may still be displayed, while the available-seats filter excludes them.

My bookings distinguishes upcoming activity from history using start time and state. Reservations and Event participation remain related but have different meanings: an unconfirmed Event is a plan awaiting qualification, not a confirmed restaurant reservation. Status colours support that distinction. A past booking indicates that its scheduled time has passed; it does not establish attendance or successful meal completion.

### 5.6.2 EatTogether Participation and Automatic Confirmation

Each new participation occupies one EatTogether seat. Friends who want to attend together need their own verified accounts and Join separately. Creation adds the host as the first diner. The backend rejects new multi-seat participation and repeated Join requests cannot add extra seats. A diner must Join an existing eligible Event with space at the same slot before creating another one, and cannot participate in competing active Events for that slot.

Events can have fixed age and gender eligibility preferences. The host must satisfy their own preferences, which remain unchanged through Handover. Verification, adulthood, suspension, preferences and blocks are checked by the server. Age eligibility uses the dining date. Other participants can see names and exact ages, but private birth dates and reliability strikes are not published.

@figure lifecycle | Figure 5.3 Event qualification Cutoff and Last Call

An Event automatically becomes CONFIRMED once its diner count reaches the slot minimum. The shared Booking is created or updated in that transaction. Confirmation does not freeze membership: eligible diners may continue to Join until the table limit or pool limit is reached, and members may Leave before dining subject to the applicable warning. Before Cutoff, falling below the minimum returns the Event to OPEN and its booking to PENDING.

Cutoff is two hours before the dining time. No new Event may be created after Cutoff. A short unconfirmed Event enters PRICE_DECISION: each member can accept full price or decline without a reliability strike. Accepted members can continue with a zero-discount booking; unresolved decisions are reconciled by dining time, and an Event with no remaining accepted diner expires.

If a confirmed Event loses enough diners after Cutoff to fall below the minimum, it enters LAST_CALL. The system sends in-app invitations to eligible verified diners whose configured dining area is within approximately five kilometres. This uses stored local locations, not live GPS. Reaching the minimum again restores the discount. If the Event remains short at dining time, the remaining diners continue at full price. Leaving during Last Call is an exception to the late-Leave penalty.

### 5.6.3 Semantic Discovery and Personal Shortlisting

For you accepts a typed dining preference, optional cuisine and optional location/radius. The visible feature recommends restaurants only. Backend support for Event ranking remains for compatibility and tests, but no Restaurant versus EatTogether choice is exposed in the popup. Save records interest; it does not reserve a table or Join an Event.

The model is Xenova/all-MiniLM-L6-v2 at pinned revision 751bff37182d3f1213fa05d7196b954e230abad9, using quantised CPU inference, mean pooling and normalisation. It produces 384-dimensional sentence vectors, consistent with the MiniLM model card (Sentence Transformers, n.d.). Transformers.js supports local model paths and disabling remote loading (Hugging Face, n.d.).

@figure semantic-search | Figure 5.4 Restaurant semantic retrieval and shortlisting

Changed descriptions are detected through a hash containing both description and model version and re-embedded during discovery. The query is embedded locally. Eligible vectors are ranked using PostgreSQL cosine distance; pgvector supplies the vector type and distance operator (pgvector contributors, n.d.). At most 30 results are returned.

Explicit cuisine is a hard constraint, applied before ranking. A Western selection therefore cannot return Chinese venues merely because their descriptions are semantically similar. If no venue satisfies the filters, the result is empty rather than falling back to another cuisine. Typed locations resolve against local metadata; unknown locations produce an input error. Radius uses approximate straight-line distance rather than a travel route.

Users review ranked cards and save or skip using buttons, keyboard or swipe interaction. Decisions persist per account and can be undone. Booking and Join actions remain separate and recheck current inventory. Ranking is descriptive retrieval, not learned personal preference, a guaranteed dietary filter or a compatibility score between diners.

### 5.6.4 Communication Notifications and Private Safeguards

Notifications are stored per account with deduplication keys. The bell shows unread records, while Profile retains notification history including read notices; both use three-item pagination. Confirmation, Cutoff decisions and Last Call are communicated in-app. Five-second polling refreshes notices while the application is open; there is no email, SMS or mobile push service.

Event chat opens after confirmation, including accepted full-price continuation, and is restricted to current members. Messages are plain text, blocked authors are hidden, and cancelled or expired Event conversations are read-only. Leaving removes current-member chat access. Private feedback is available after dining time and requires a self-attendance declaration. It stores feedback on the experience rather than publishing a star rating on diner profiles.

Safety controls allow members to report or block another diner. Blocks affect eligibility in either direction, and a protective Leave can avoid the normal penalty. Reports are persisted privately, but a moderation console and operational response process have not been implemented.

The Profile reliability display shows the account's own rolling strike count and explains the policy through an information tooltip. A penalised late Leave from a confirmed Event after Cutoff records a deduplicated strike. Three strikes within 90 days cause a seven-day EatTogether suspension; ordinary reservations remain available. Restaurant attendance signals and no-show penalties are deferred, so reliability is not a measured attendance rate or a public reputation score.

## 5.7 Requirement to Implementation Traceability

Table 5.4 connects the agreed consumer-side requirements to implementation and engineering evidence. Passing checks establishes behaviour in the tested conditions, not commercial effectiveness or user acceptance.

@table Table 5.4 Requirement design and verification traceability
| Requirement | Implementation decision | Verification evidence |
|---|---|---|
| Preserve ordinary booking | Book remains default within restaurant details. | Reservation and shared-pool integration scenarios; browser checks. |
| Integrate EatTogether into Eatigo | One venue collection with counts and expandable Events in grid and map. | Unified discovery unit cases and desktop/phone checks. |
| One verified diner per seat | Session identity, verification and single-seat membership checks. | Multi-seat rejection, duplicate Join and eligibility scenarios. |
| Qualify without host confirmation | Transactional automatic confirmation and stable shared booking. | Leave/rejoin requalification and booking-reference assertions. |
| Prevent over-allocation | Shared seat pool, owner constraints and slot row locking. | Concurrent Join and ordinary/Event competition scenarios. |
| Handle short Events fairly | Cutoff, individual full-price decisions and Last Call. | Time-transition and inventory-release scenarios. |
| Preserve participation after Handover | Earliest remaining member becomes host. | Ownership, immutable preferences and Handover checks. |
| Support descriptive discovery | Local vectors plus strict cuisine, radius and availability constraints. | Real-model retrieval and conflicting-cuisine regression assertions. |
| Retain account-specific history | Personal booking removal, shortlist and notification read state. | Ownership and isolation tests; notification browser checks. |
| Provide basic social safeguards | Private strikes, blocks, reports, feedback and member chat. | Privacy, membership, blocking and penalty scenarios. |
| Deliver a reproducible local MVP | Three containers, migrations and tested source artifact. | Isolated integration stack and delivery/deployment scripts. |

Discovery does not allocate inventory. The final booking or Join transaction decides whether an option remains available. This boundary allows ranking and presentation to evolve without weakening the shared reservation rules.

## 5.8 Testing and Quality Assurance

Verification focuses on account isolation, incorrect lifecycle transitions, over-allocation, privacy leaks and recommendation constraint failures. The recorded local checks on 11 October 2026 passed formatting, TypeScript checks and all 33 unit tests: seven backend and 26 frontend. Fresh isolated Docker integration passed HTTP authentication, 21 dining scenarios and a real-model discovery test containing multiple assertions. These results are documented in docs/TESTING.md; they are local engineering evidence, not a claim about the status of a later GitHub run.

@table Table 5.5 Verification coverage and interpretation
| Check | Behaviour exercised | Interpretation |
|---|---|---|
| Unit tests | Credentials, identity calculations, status handling, paging and discovery filters | Small decision functions behave as asserted. |
| HTTP authentication | Health, login, separate sessions, safe fields and logout | Session behaviour works through the Nginx API boundary. |
| Dining integration | Shared inventory, eligibility, concurrency, lifecycle, safeguards and ownership | Database-backed business rules hold in the tested scenarios. |
| Real-model discovery | Ranking, hard cuisine, radius, malformed input, save/skip and undo | Local inference and retrieval cooperate on the seeded catalogue. |
| Static and build checks | Formatting, TypeScript compilation and production builds | The checked source compiles and packages successfully. |
| Browser review | Desktop and 390px phone layouts, grid/map, popup, notifications and booking flow | Reviewed screens and interactions work at those viewport sizes. |
| Recorded offline inference | A 384-dimensional result with Docker networking disabled on 25 September | The bundled model can run without a hosted inference connection. |

Concurrency tests inspect final memberships, allocations and booking references as well as response codes. Eligibility cases reject unverified, underage, blocked or unsuitable diners, and test that inaccessible Events do not leak through direct identifiers. Lifecycle scenarios cover requalification, Cutoff decisions, released held seats, Last Call, Handover and reliable cancellation. Discovery asserts that an explicit cuisine survives a conflicting mood and returns no unsuitable fallback.

The ci:integration command creates a uniquely named Compose project on a separate port with a fresh database volume. It builds services, applies migrations, seeds fixtures and exercises the public HTTP route. Cleanup removes that test stack and its own volumes. It does not use the laptop demonstration database. Local browser verification used specifically named temporary records, then removed them; recorded fingerprints preserved the original 16 bookings, 117 memberships and 14 notifications/read states.

### Evaluation still required

Automated browser regression, load testing, systematic accessibility auditing and security testing are not established by the current evidence. A phone-width viewport review is not a physical second-device connectivity test. No latency percentile, throughput target, uptime or accessibility-compliance claim is made.

Product evaluation remains separate. Participants should be asked to find a restaurant, distinguish saving from booking, Join an Event and understand Cutoff/full-price choices. Recommendation relevance should be evaluated on independently judged requests and compared with a keyword baseline. Existing targeted retrieval assertions are regression tests, not a held-out relevance benchmark. Adoption, satisfaction, attendance and restaurant revenue have not been measured.

## 5.9 Deployment and Continuous Delivery

### Local service startup and persistence

Docker Compose checks PostgreSQL readiness with pg_isready before starting the backend. The backend applies migrations, runs the seed routine and starts Express. The frontend waits for backend health. Compose supports this service-health startup ordering (Docker, n.d.). Health checks query the database but do not warm the embedding model.

From the repository root, docker compose up --build -d builds and starts the application at http://localhost:3000. When no rebuild is needed, docker compose up -d starts existing services. docker compose down removes containers and the network while retaining the named postgres_data volume. Removing that volume would erase application data.

Stable fixture identifiers and upserts preserve existing records while creating missing demo data. Startup seeding creates a seven-day window of future slots; it does not continuously advance that window while the backend remains running. Seorae and Yan Lai Ju fixtures use a four-diner minimum, a six-diner table limit and a 12-seat pool; other venues use two, four and eight respectively. These are synthetic demonstration conditions, not current restaurant offers.

After initial image, package and model downloads, photos, map geometry and inference are local. A phone must still reach the running host using http://<host-LAN-IP>:3000. The IP can change across networks, and firewall or Wi-Fi client isolation may prevent access. The current deployment uses HTTP on the laptop, without a public domain or TLS configuration.

### CI checks and delivery package

GitHub Actions runs on pushes to main, pull requests targeting main, and manual workflow dispatch. Local commits alone do not trigger it. The workflow has three dependent jobs: Code checks, Docker integration and Prepare release. GitHub's needs dependencies require preceding jobs to succeed before the delivery job proceeds (GitHub, n.d.).

@figure ci-delivery | Figure 5.5 CI and continuous delivery with manual local deployment

Code checks installs locked npm dependencies, generates the Prisma client, checks formatting and types, runs unit tests and builds the application. Docker integration then executes the isolated stack described in Section 5.8. For successful main runs, Prepare release packages the tested source commit with its SHA, a SHA-256 archive checksum, integration evidence, instructions and deploy.ps1. Pull requests validate changes without producing that delivery package. Integration artifacts are retained for one day and delivery artifacts for three days in the current workflow.

This is continuous integration and continuous delivery with manual deployment. It does not update the running laptop application on every push, publish a GitHub Release or push container images to a registry. A green workflow means the configured checks passed for that commit, not that all possible defects have been excluded.

### Manual deployment and rollback boundaries

The operator downloads and extracts a chosen delivery artifact and runs ./deploy.ps1 -ValidateOnly to inspect its package integrity, followed by ./deploy.ps1 to deploy. The script checks package metadata and evidence, rebuilds the services, starts the existing Compose project and checks readiness and the served version identifier. It retains the existing database volume, so real demonstration bookings are separate from the disposable CI database.

The artifact contains tested source rather than prebuilt immutable service images. Deployment rebuilds from that source, and unpinned operating-system or base-image components can still change. Selecting an older source artifact can restore application code, but does not automatically reverse database migrations. Backups and migration compatibility would be required for a dependable operational rollback process.

## 5.10 Technical Limitations and Next Steps

### Prototype inventory and identity

The shared-pool model demonstrates competition between ordinary reservations and Events, but it does not model physical table assignment, table combinations or live restaurant updates. Full-price continuation changes the prototype booking discount; it does not charge a card or obtain restaurant approval. The eight imported venues and synthetic inventory cannot confirm an actual Eatigo reservation. Older multi-diner memberships are preserved until explicitly reduced to one seat; the single-diner rule governs new participation.

Verification flags, ages and genders represent preverified fictional identities. They are not returned by Singpass. Demo passwords are stored in plaintext and shared across accounts. The local HTTP cookie is not Secure; production password hashing, rate limiting, secret management and an explicit CSRF strategy are not implemented. The session and ownership checks support the classroom workflow, not a public authentication deployment.

### Deferred restaurant operations and safety

Restaurant accounts, a merchant application, Restaurant Events, merchant slot exclusions and Corppass verification are deferred pending the team's product decision. There is no restaurant attendance recorder or trustworthy no-show signal, so no-show strike enforcement is also deferred. Past bookings and self-declared feedback cannot establish actual attendance.

Member chat, private reports and blocks provide basic controls, but the application lacks an operational moderation console, investigation process and appeals workflow. The reliability display is an individual's strike count, not a public rating or verified attendance score. These distinctions should remain clear in the demonstration and later measurement plan.

### Recommendation and operational limits

MiniLM is a general sentence model and has not been trained on local dining outcomes. Hard cuisine filters correct explicit category mismatch, but semantic ranking can still mishandle negation, mixed-language requests and dietary needs. Local location matching covers only the bundled catalogue and neighbourhood data; radius is not travel time. No fairness or relevance benchmark has been completed.

Inference and lifecycle work share one backend process. Changed descriptions are indexed during search; a first request can be slower. Exact vector ranking and application-side eligibility checks suit the current small dataset without proving larger-scale performance. Five-second polling is simple for a demo but adds traffic as more clients connect. Background indexing, separate inference or event-driven updates should follow measured need rather than be assumed necessary now.

The system depends on the host laptop, Docker Desktop and network availability. CI provides repeatable checks and a delivery package, while manual deployment preserves operator control; it does not supply backups, monitoring, failover or disaster recovery. The next phase should validate the consumer journey with users and confirm the deferred merchant rules before extending the application or making business-impact claims.

## Technical References

Docker. (n.d.). Control startup and shutdown order in Compose. https://docs.docker.com/compose/how-tos/startup-order/

GitHub. (n.d.). Workflow syntax for GitHub Actions. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

Hugging Face. (n.d.). Use custom models. Transformers.js documentation. https://huggingface.co/docs/transformers.js/custom_usage

pgvector contributors. (n.d.). pgvector vector similarity search for Postgres. https://github.com/pgvector/pgvector

PostgreSQL Global Development Group. (n.d.). Explicit locking. PostgreSQL 16 documentation. https://www.postgresql.org/docs/16/explicit-locking.html

Sentence Transformers. (n.d.). all-MiniLM-L6-v2 model card. https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

Implementation evidence: backend/src/dining.ts, event-lifecycle.ts, inventory.ts, social.ts, reliability.ts, discovery.ts, embeddings.ts, server.ts and seed.ts; backend/prisma/schema.prisma and migrations; frontend/src; docker-compose.yml; .github/workflows/ci.yml; scripts/ci-integration.mjs; scripts/package-release.mjs; scripts/deploy.ps1; docs/TESTING.md; docs/DISCOVERY.md; and docs/SOURCES.md. Application source snapshot dc360ad, reviewed 11 October 2026. Engineering evidence is distinguished from later product research and deferred restaurant functionality throughout this section.
