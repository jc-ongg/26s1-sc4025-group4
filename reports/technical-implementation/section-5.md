# 5 MVP and Technical Implementation

The Eatigo prototype implements restaurant discovery and reservations, with Eatogether as an optional way for diners to form a group before confirming a shared booking. The technical design preserves the ordinary reservation journey while allowing both journeys to use the same inventory. A local semantic search feature helps diners find restaurants or open parties from a description of their dining preferences.

This implementation provides a working browser interface, authenticated APIs and persistent database operations. Its principal technical contribution is the connection between group formation, reservation availability and recommendation eligibility. A party shown in a search result must still satisfy the booking rules when a diner joins it; a successful recommendation never bypasses capacity or ownership checks.

## 5.3 System Architecture and Technology Stack

The application uses a three-tier architecture consisting of a React frontend, an Express backend and a PostgreSQL database. These run as three Docker Compose services on one host. The backend contains separate modules for authentication, dining operations and semantic discovery, but remains one deployable application. This modular monolith keeps the operational workload manageable for a single Product Engineer while separating the main responsibilities in the source code.

Figure 5.1 shows the runtime arrangement. The frontend container serves the compiled application through Nginx and exposes port 3000 on the host. Browser requests to /api are forwarded to the backend on port 4000 inside the Compose network. The database is accessible to the backend within that network and has no host port published in the current configuration. The browser therefore accesses the interface and API through one origin, without needing separate API addresses for a laptop and a phone.

@figure architecture | Figure 5.1 Runtime architecture and deployment boundaries

The embedding model runs within the backend process on the host CPU. Its model files are downloaded during the Docker build, and remote model loading is disabled at runtime. PostgreSQL stores both the relational application data and the vectors used for semantic ranking. This avoids operating a separate inference server or vector database for a small demonstration dataset.

The design prioritises a complete, reproducible reservation journey over service-level scalability. A single backend process is straightforward to run and debug, but it also couples recommendation work to ordinary API traffic. CPU inference is serialised to limit competing model allocations. A larger deployment would require measured throughput and latency data before deciding whether inference should become a separate service.

### Technology choices

Table 5.1 summarises the technologies used in the implementation. Versions describe the project configuration rather than a recommendation to adopt the latest available release.

@table Table 5.1 Technology stack and implementation rationale
| Layer | Technology | Role and rationale |
|---|---|---|
| Interface | React 19 and TypeScript | Component-based pages and typed application models support consistent restaurant, group and booking displays. |
| Frontend tooling | Vite 7 and CSS | Compiles the browser application; shared CSS files control typography, surfaces and responsive layouts. |
| Web serving | Nginx | Serves compiled assets and proxies /api requests through the same browser origin. |
| Application server | Node.js 22 and Express 5 | Handles authentication, JSON endpoints and reservation rules in a TypeScript codebase. |
| Data access | Prisma 6 | Defines relational models, generates a typed client and manages database migrations. |
| Database | PostgreSQL 16 and pgvector 0.8.2 | Stores accounts, reservations and groups alongside 384-dimensional embeddings. |
| Semantic inference | Transformers.js 3.8 and quantised MiniLM | Produces sentence embeddings locally on CPU without a hosted model API. |
| Map | Leaflet 1.9 and local GeoJSON | Displays restaurant locations using bundled geographical data rather than online map tiles. |
| Packaging and checks | Docker Compose, Node test runner and Prettier | Packages services, exercises application behaviour and maintains consistent formatting. |

TypeScript is used on both sides of the API, although the frontend response types are maintained separately rather than generated from an API schema. Prisma supplies typed access to the relational models. Vector columns are declared as unsupported database types in Prisma and accessed through parameterised SQL where required. This combination keeps ordinary data operations readable while retaining pgvector functionality.

## 5.4 Application Design and API Boundaries

### Frontend organisation

The frontend separates the login shell from the authenticated dining application. On loading, the root component checks /api/auth/me and either restores the session or displays the login form. The main application then uses hash-based navigation for Restaurants, Eatogether and My bookings. Restaurant and party detail views retain their identifiers in the URL, allowing navigation back to the same record without storing the entire journey in component state.

The page modules reflect the product tasks. RestaurantPages manages browsing and booking; RestaurantMap handles spatial browsing; GroupPages handles party discovery and participation; Discover implements semantic search and shortlisting; and Bookings consolidates the account's reservations and Eatogether parties. Shared components in dining-ui provide consistent loading, error, date and time behaviour. Dates are displayed in the Asia/Singapore time zone.

Ordinary booking is the default action on the restaurant detail page. The Book and Eatogether toggle exposes group creation as an additional choice rather than requiring every diner to use the social feature. Within Eatogether, Explore parties provides direct browsing and For you provides semantic discovery. My bookings displays reservations on the left and Eatogether parties on the right at desktop widths. Each list has independent pagination with two records per page, while narrower layouts stack the sections.

The interface uses local React state for form inputs, selected views, pagination and temporary feedback. Persisted entities remain on the server. A shared resource hook polls relevant dining resources every five seconds and refreshes them after mutations. It prevents overlapping requests within the active polling cycle and ignores responses after the effect is disposed. Existing content stays visible during refreshes of the same resource, reducing the flicker caused by replacing populated content with a loading state.

Polling makes another diner's changes visible on a later refresh; it does not provide instant synchronisation. Server validation remains necessary because a displayed seat can become unavailable before a user clicks Join. The interface disables actions while its request is pending and displays an error if the backend rejects an operation. These controls improve feedback, but the database transaction is what enforces the reservation rule.

### Backend responsibilities and authentication

The Express entry point configures JSON parsing, cookies, authentication endpoints and error handling. The dining router applies session authentication before its own endpoints and before the downstream discovery router. Protected requests resolve the user from the server-side session rather than trusting an account identifier supplied by the browser.

The MVP uses four pre-created demonstration accounts. Login normalises the email address and compares the submitted password with the stored demonstration password. A successful login creates a random 32-byte token, stores a session with a 24-hour expiry and sets an HttpOnly, SameSite=Lax cookie. Logout removes the corresponding session and clears the cookie. Public account responses expose the account ID, name and email, while participant displays use names and IDs.

All accounts use the same application model. Hosting a party is a relationship between a user and a specific group, rather than a separate restaurant or host account type. The API checks that relationship when confirming or cancelling a party. This allows a person to host one party and join another without changing account roles. Registration, password recovery and restaurant management are outside the implemented scope.

### API contract

The API exchanges JSON through the /api prefix. Table 5.2 groups endpoints by user task. Mutation endpoints use POST, including cancellation and personal deletion. The design is a small HTTP JSON API rather than a fully documented, versioned public API.

@table Table 5.2 Main API endpoints
| Method and path | Purpose | Key rule |
|---|---|---|
| GET /health | Check API and database readiness | Executes a database query; does not warm the embedding model. |
| POST /auth/login; GET /auth/me; POST /auth/logout | Start, inspect and end a session | Credentials and token are validated on the server. |
| GET /restaurants and /restaurants/:id | Retrieve venues and future slots | Listing returns active restaurants; allocations identify unavailable slots. |
| POST /bookings | Make an ordinary reservation | Future, unallocated slot and valid party size required. |
| GET /groups and /groups/:id | Browse parties and inspect details | Browse list contains future OPEN or FULL groups at active venues. |
| POST /groups | Create a party and hold its slot | Host is added as the first member; capacity must fit the slot. |
| POST /groups/:id/:action | Join, leave, confirm or cancel | Membership, capacity, lifecycle and host rules are checked. |
| GET /me/bookings and /me/groups | Retrieve personal plans | Records must belong to the account or a group it participates in. |
| POST /bookings/:id/cancel or /delete | Cancel or hide a cancelled booking | Cancellation checks ownership; deletion affects only the requesting account. |
| POST /discovery/search | Retrieve semantically ranked candidates | Valid preferences, eligibility and optional radius filters apply. |
| POST /discovery/decision; GET /discovery/saved | Save, skip, undo and retrieve a shortlist | Decisions are scoped to the authenticated account. |

The server distinguishes malformed input from conflicting state. For example, an invalid party size receives HTTP 400, an unauthenticated request receives 401, an unauthorised host action receives 403, and a seat that has already been taken receives 409. A local model failure produces 503 rather than silently substituting a different recommendation method. This makes failures understandable to the interface and keeps the meaning of a successful response consistent.

### External data boundaries

There is no live connection to Eatigo's reservation system. The eight restaurant examples and their photographs were imported from public branch pages as a source snapshot. Reservation times, discounts, capacity, demonstration identities and group activity are generated locally. A confirmed reservation therefore represents a state change in this prototype, not a booking accepted by the real restaurant.

The map uses a bundled OpenStreetMap-derived extract covering western and central Singapore. Leaflet renders this data locally, while restaurant coordinates come from the imported venue metadata. There is no runtime tile service, external geocoder or payment provider. Initial package and model downloads require network access; ordinary application use does not require those providers after setup. Source records and attribution are retained in docs/SOURCES.md and the map notice.

## 5.5 Data Model and Reservation Consistency

The data model distinguishes a restaurant, a reservation opportunity, a party and a confirmed booking. A Restaurant has multiple ReservationSlot records. Each slot represents one exclusive reservation opportunity with a start time, minimum party size, capacity and discount. This is a deliberate simplification of restaurant inventory: the prototype does not model multiple physical tables, combined tables or multiple simultaneous allocations for one slot.

Figure 5.2 shows the core relationships. The separate membership entity represents the many-to-many relationship between users and groups. A shared booking references one group, while an ordinary booking has no group reference. Both types still refer to the same ReservationSlot entity.

@figure data-model | Figure 5.2 Core data relationships and exclusive slot allocation

@table Table 5.3 Main entities and constraints
| Entity | Important fields or key | Responsibility |
|---|---|---|
| User and Session | Unique email; token primary key; expiry | Account identity and server-side login sessions. |
| Restaurant | ID; active flag; coordinates; vector(384) | Venue content, map position and semantic description. |
| ReservationSlot | Unique restaurant and start time | Defines party limits, discount and the reservation opportunity. |
| SlotAllocation | Slot ID primary key; optional group or booking ID | Enforces one allocation owner per slot. |
| GroupDiningSession | Host ID; slot ID; status; capacity | Stores the social party and its lifecycle. |
| GroupDiningMember | Composite key of group ID and user ID | Prevents the same account occupying two seats in one group. |
| Booking | Optional unique group ID; party size; status | Stores an ordinary or shared confirmed reservation. |
| DiscoveryDecision | Composite key of user ID and target key | Stores each account's SAVE or SKIP decision. |

SlotAllocation is central to the consistency design. Its slot ID is the primary key, so a slot can have at most one allocation record. A database CHECK constraint requires exactly one owner: either a group ID or an ordinary booking ID. Group and booking references are also unique. An open party therefore holds the slot immediately and prevents an ordinary booking from claiming it while diners are assembling.

When the host confirms a group, the system creates a Booking linked to that group and records its current member count as partySize. The allocation remains owned by the group; it is not converted into a second booking-owned allocation. The unique group reference on Booking prevents multiple bookings for the same party. Repeated confirmation by the host returns the existing confirmed result.

### Transactions and competing requests

Every dining mutation that changes inventory acquires the same ReservationSlot row lock using SELECT FOR UPDATE within a Prisma transaction. The code checks the relevant conditions after obtaining that lock. If two requests compete for the same last seat or the same reservation slot, the requests are serialised around that shared row. PostgreSQL documents that this lock blocks competing updates and locking operations until the transaction ends (PostgreSQL Global Development Group, n.d.).

For example, suppose a two-person party already contains its host. Three other diners submit Join concurrently. The first successful transaction adds one member and marks the group FULL. The later transactions read the updated membership after obtaining the lock and return a conflict. The integration test checks for one successful response, two conflicts and a final member count of two. The same locking convention also covers ordinary booking versus group creation, so the two journeys cannot each allocate the same slot through separate code paths.

Database constraints provide a second layer of protection. They restrict discounts to 0–100, require valid slot capacity ranges, restrict booking and group sizes to 1–20, and enforce unique membership and allocation records. Conditions spanning multiple rows, such as whether a group's member count fits its capacity, remain in the transaction logic. Neither client-side validation nor TypeScript types alone would enforce these conditions under concurrent requests.

### Cancellation, expiry and history

Before a reservation starts, an ordinary booking owner can cancel it and release its allocation. A group host can cancel the party; if a shared booking exists, that booking is cancelled as part of the same transaction. Members cannot cancel the entire party. They can leave an unconfirmed party, and leaving a FULL party returns it to OPEN. After confirmation, membership is frozen so the booking's party size does not drift away from the confirmed membership.

Unconfirmed groups expire when their slot start time is reached. Expiry is processed when an authenticated API request runs the dining middleware, which checks overdue groups, locks the affected slots and releases their allocations. There is no continuously running expiry worker. A stored status can therefore remain OPEN or FULL until the next request processes it, although time checks prevent joining a party whose slot has started.

The Delete action on a cancelled booking is personal removal from history. It adds the requesting account to Booking.deletedFor rather than deleting the shared row. This preserves the record for other participants and avoids losing the relationship between the group and its cancelled reservation. It is not a general account-data erasure mechanism. Archived restaurant records are similarly retained so that historical bookings continue to reference the original venue.

## 5.6 Functional MVP Implementation

### 5.6.1 Restaurant Discovery and Ordinary Reservations

The restaurant journey provides a familiar starting point for the proposed feature. Diners browse a top-picks carousel and restaurant cards, search by restaurant text and apply cuisine filters. A full-width Restaurant view and Map view toggle changes the presentation of the venue collection. On the map, restaurant photographs and name labels identify venues; selecting one reveals its details and related Eatogether parties. A map marker represents a restaurant rather than an individual party.

On a restaurant detail page, the diner selects a future time slot and sees its discount and party-size requirements. Book is the default mode. Submitting a valid party size creates a confirmed reservation only if the slot remains available at transaction time. The result appears in My bookings, where the owner can cancel a future reservation and subsequently remove the cancelled entry from their personal history.

The catalogue contains eight real restaurant examples, including Joya Onsen Cafe, Seorae Korean Charcoal BBQ, 2SCOOPS and il Cielo. Their presence gives the demonstration recognisable locations and cuisine descriptions, but the time slots and discounts are synthetic. The seed routine creates a seven-day window of future slots, each with a minimum of two diners and capacity of four. This makes the minimum-party-size scenario reproducible without implying that those conditions describe the restaurants' current offers.

### 5.6.2 Eatogether Party Formation and Host Confirmation

Eatogether adds a group-formation stage before confirmation. A diner can create a party from an available restaurant slot, provide a title and description, and choose a capacity within the slot's limits. The creator becomes the host and occupies the first seat. Other authenticated diners can inspect the party and join while it is open and has capacity. A joined account cannot consume another seat by repeating the request.

Figure 5.3 describes the implemented lifecycle. OPEN means the group can accept members. FULL means it has reached its selected capacity, but the host has not yet confirmed the reservation. The host may confirm from either state once the restaurant's minimum party size is met. This distinction matters: reaching the minimum and reaching capacity are different conditions, and a group does not need to fill every optional seat before booking.

@figure lifecycle | Figure 5.3 Eatogether lifecycle and confirmation rules

For example, a host can create a four-person party at a slot requiring at least two diners. With only the host present, confirmation is rejected. Once one other diner joins, the host can confirm a booking for two people even though the group is still below capacity. Confirmation creates one shared booking and prevents further joining or leaving. The booking is visible to its participants; it is not duplicated into an independent restaurant reservation for each person.

The host retains the decision to confirm because joining expresses participation in a group, while confirmation commits its current size to the reservation. The interface exposes that difference, and the API enforces it. A normal participant receives a forbidden response if they attempt a host-only action. This control supports the agreed product flow without introducing a separate restaurant account or restaurant approval process.

### 5.6.3 Semantic Discovery and Personal Shortlisting

For you accepts a freely typed dining preference and provides a Restaurant or Eatogether toggle. The interface defaults to Restaurant and leaves the preference and location inputs empty. In Eatogether mode, ranking applies to eligible open parties, connecting the discovery tool to the social dining feature. Saving a result expresses interest; booking or joining is a separate explicit action.

The retrieval approach uses sentence embeddings to compare meaning rather than requiring identical words. Reimers and Gurevych (2019) established sentence embeddings and cosine similarity as a practical basis for semantic comparison. In this prototype, the chosen model is the ONNX version of all-MiniLM-L6-v2 distributed by Xenova, run through Transformers.js. It produces a 384-dimensional representation with mean pooling and normalisation. The implementation uses quantised CPU inference and a pinned model revision, without task-specific fine-tuning (Sentence Transformers, n.d.; Xenova, n.d.).

Restaurant embedding text combines the venue name, cuisine, area, description, tags and signature dishes. Group embedding text adds the party title and description to its restaurant context. A content hash includes the model version and text. On a search request, changed records are embedded again, while unchanged records retain their stored vectors. Concurrent search requests share the indexing pass within the backend process. The query is then embedded using the same model.

@figure semantic-search | Figure 5.4 Semantic retrieval with eligibility checks and explicit user decisions

Before vector ranking, the service builds the eligible candidate set. Restaurant mode requires an active venue with an unallocated future slot. Eatogether mode requires an OPEN group at an active venue, a future slot, a remaining seat and no existing membership for the current user. Saved and skipped targets are excluded for that account. A requested radius further restricts candidates before SQL ranking.

Location entry uses local lookup rather than unrestricted geocoding. Recognised neighbourhood names map to predefined centres, and a listed restaurant name or area can resolve to stored venue coordinates. Blank location leaves the search unrestricted. Unknown locations produce a validation message. Distances use a great-circle calculation and represent approximate straight-line distance from the resolved centre, not a route from the diner's device.

The database ranks eligible IDs by pgvector cosine distance using the <=> operator and returns at most 30 results. The score returned by the API is one minus cosine distance. The schema contains no approximate nearest-neighbour index, so this is exact vector ranking over the eligible records, appropriate to the small catalogue. pgvector supports this cosine-distance operation directly inside PostgreSQL (pgvector contributors, n.d.).

Users can save or skip a card through buttons, keyboard arrows or swiping, and undo the preceding decision. DiscoveryDecision stores the result against the authenticated user and a target key identifying the restaurant or group. The shortlist survives refresh and login sessions. These decisions do not retrain the model or build a learned user profile; they control saved content and exclusion from subsequent results.

Raw preference text is processed in memory and is not intentionally persisted by the application or sent to a hosted model provider. Runtime model loading is local-only, consistent with the library's supported configuration (Hugging Face, n.d.). Nevertheless, a vector score reflects similarity between descriptions. It does not establish interpersonal compatibility, dietary suitability or a probability that the user will enjoy a meal. A shortlisted party can also become unavailable; the join operation rechecks its current state.

## 5.7 Requirement to Implementation Traceability

Table 5.4 connects the implemented user requirements to concrete design decisions and verification evidence. The identifiers organise this technical section and can later be reconciled with the group's final PRD. They do not imply that a formal prioritisation exercise or user acceptance study has already been completed.

@table Table 5.4 Technical traceability matrix
| Requirement | Design and implementation | Verification evidence |
|---|---|---|
| R1 Browse restaurants in list and map views | RestaurantPages and RestaurantMap share venue filtering; map selects a venue before its parties. | Recorded desktop and phone-width browser checks. |
| R2 Preserve ordinary reservations | Book is the default; POST /bookings creates a booking and exclusive allocation. | Ordinary booking versus group-creation concurrency test. |
| R3 Let a solo diner assemble a party | Group creation adds the host as a member and holds a slot; other accounts can join. | Minimum-size, duplicate-join and membership tests. |
| R4 Give confirmation control to the host | Group host relationship is checked; minimum size permits confirmation before capacity. | Non-host rejection and below-capacity confirmation test. |
| R5 Prevent overbooking | Slot row locks, transactional checks and unique SlotAllocation ownership. | Concurrent last-seat joins and competing allocation tests. |
| R6 Find relevant available options | MiniLM embeddings, availability filters, local radius lookup and pgvector ranking. | Discovery integration test with semantic and geographical cases. |
| R7 Keep saved choices personal | Composite account and target key stores SAVE or SKIP; undo removes or restores a decision. | Account isolation, save, skip and undo assertions. |
| R8 Manage plans without erasing other users' history | Personal booking views, cancellation and deletedFor filtering. | Ownership, active-booking rejection and personal deletion tests. |
| R9 Run the demonstration locally | Three Compose services, local assets and model, persistent database volume. | Recorded Docker builds, HTTP checks and isolated model invocation. |

The most important cross-cutting requirement is that discovery and reservation state agree at the point of action. Search filters reduce unsuitable options, but they cannot reserve a seat for the duration of a user's decision. The transaction-backed join and booking endpoints provide the final decision. This keeps the recommendation component replaceable without weakening the inventory rules.

## 5.8 Testing and Quality Assurance

Verification concentrates on the failures most likely to invalidate the demonstration: unauthorised actions, duplicate reservations, overfilled parties, stale availability and recommendations that ignore eligibility. TypeScript checks and formatting checks support maintainability, while HTTP and database-backed tests exercise the behaviour beyond the interface.

The repository's testing record dated 25 September 2026 reports successful frontend and backend builds, two credential unit tests, HTTP authentication checks, six dining integration tests and one discovery integration test containing multiple assertions. It also records a model invocation with Docker networking disabled that returned a 384-dimensional embedding. Frontend and backend TypeScript checks and both credential unit tests passed again on 26 September 2026 after regenerating the local Prisma client. These are engineering checks on the demonstration system, not measurements of user adoption, satisfaction or commercial impact.

@table Table 5.5 Verification coverage and interpretation
| Check | Behaviour exercised | What the evidence supports |
|---|---|---|
| Credential unit tests | Normalisation and malformed or missing inputs | Predictable parsing before account lookup. |
| HTTP authentication script | Readiness, login, safe account fields, separate sessions and logout revocation | Authentication works across the public Nginx API route. |
| Dining integration tests | Permissions, lifecycle, minimum size, concurrency, expiry and personal deletion | Core booking rules hold for the tested database-backed scenarios. |
| Discovery integration test | Real-model ranking, radius, available seats, saved decisions and undo | Retrieval and shortlist operations work together on the seeded dataset. |
| Build and static checks | TypeScript compilation and production packaging | The checked source can compile into the demonstration services. |
| Browser review | Navigation, map, phone layouts, pagination, shortlist and overflow | The reviewed screens and interactions display correctly at checked widths. |
| Offline model check | Local model invocation with container networking disabled | Inference can execute from bundled files without a model-provider connection. |

### High-risk functional scenarios

The concurrency tests verify resulting data as well as response codes. A last-seat test sends three join requests for one remaining place and expects exactly one success. A second test races an ordinary reservation against group creation for the same slot and expects one created response and one conflict, followed by exactly one allocation. This targets the shared inventory rule directly instead of relying on a button being disabled in one browser.

Lifecycle tests cover confirmation below capacity after the minimum is reached, rejection of non-host confirmation and cancellation, repeated confirmation returning the same booking, and frozen membership after confirmation. Another test moves an unconfirmed group's slot into the past, triggers an API request and verifies EXPIRED status and allocation release. Personal deletion tests verify that a cancelled shared booking disappears for one participant while remaining visible to another.

The discovery test checks selected semantic examples using the real local model. A Korean grilled-meat query is expected to rank Seorae first, a frozen-dessert query to rank 2SCOOPS first, and an Italian pasta query in restaurant mode to rank il Cielo first. It also verifies radius filtering, typed-location normalisation, invalid-location handling, account-isolated shortlists and undo. These are targeted regression cases; they do not constitute a held-out recommendation benchmark or establish superiority over keyword search.

Integration tests create identifiable fixtures and remove the records they create. Dining tests use dedicated future slots, and discovery tests create temporary users. They should run on the demonstration database rather than a production database. The discovery cases still depend on the seeded catalogue and suitable open parties, so changing or exhausting that data can affect their results.

### Evaluation still required

Participant usability testing, recommendation relevance evaluation and physical second-device connectivity testing remain separate work. A useful next evaluation would ask participants to find a meal, join a party and distinguish a saved option from a confirmed booking. The study should record completion, errors and time to complete each task. A held-out set of dining requests could compare semantic ranking with a keyword baseline using independently judged relevant results. Neither study has been completed as part of the recorded engineering checks.

Automated browser regression coverage, load testing, systematic accessibility auditing and security testing are also absent from the current evidence. Labels, keyboard controls and status messages exist in the interface, but their presence alone does not establish accessibility compliance. No latency percentile, maximum concurrent-user capacity or uptime guarantee is claimed.

## 5.9 Deployment and Reproducibility

Docker Compose defines the database, backend and frontend services. Database readiness is checked with pg_isready. The backend starts after the database becomes healthy, applies Prisma migrations, runs the seed routine and starts Express. The frontend starts after the backend health check succeeds. Backend health checks query the database; they do not establish that the first semantic search has already loaded and warmed the model.

From the repository root, docker compose up --build -d builds and starts the application. The frontend is then available at http://localhost:3000 on the host. When the images are already available and no rebuild is needed, docker compose up -d starts the existing services. docker compose down stops and removes the containers and network while preserving the named database volume. Removing that volume would erase the persisted application data.

The first build downloads base images, packages and the pinned embedding model. After setup, the application serves its own photos, map geometry and model files. A client still needs access to the running host: this is a locally hosted web application, not an installed offline application with an independent database on each phone. Source attribution links require internet access when opened.

A phone on a network that allows access to the laptop can use http://<host-LAN-IP>:3000. The address depends on the laptop's current network assignment; it is not permanently fixed to a particular private IP. A firewall or Wi-Fi client-isolation policy can prevent access even when both devices use the same Wi-Fi name. The current configuration provides HTTP for the demonstration, without a public domain or TLS deployment.

PostgreSQL data persists in the postgres_data named volume. Startup seeding uses stable identifiers and upserts to create missing demonstration data while preserving existing groups and bookings. It does not continually roll the seven-day inventory forward while the service runs; restarting the backend reruns the seed routine. Git tracks the code, migrations, import scripts and asset provenance. The implementation described here corresponds to commit 524de60, with test procedures and source records retained in the repository documentation.

This setup makes the classroom demonstration repeatable on the host, but it does not provide backups, failover or a production operations process. Availability depends on the laptop, Docker Desktop and the local network remaining available. A public pilot would require additional deployment controls and a separate data-protection plan.

## 5.10 Technical Limitations and Next Steps

### Demonstration data and inventory model

The MVP reproduces the reservation workflow using eight venue examples and locally generated inventory. It cannot confirm a real restaurant reservation, check current offers or synchronise cancellations with Eatigo. Each restaurant and start time has one exclusive allocation, even when the party uses fewer seats than the slot capacity. Production restaurant inventory would need a richer model for table counts, capacity combinations, merchant updates and reconciliation with the booking provider.

An Eatogether party holds its complete slot from creation until cancellation, expiry or the continuation of its confirmed booking. There is no shorter hold timeout, per-account creation quota or waitlist. This is adequate for demonstrating group formation but could block inventory if users create parties and abandon them. A pilot should investigate hold duration and cancellation policy alongside the product team rather than choosing those rules solely for implementation convenience.

### Authentication and social safeguards

Demonstration passwords are stored in plaintext, exposed as example credentials in the interface and shared across the seeded accounts. The session cookie is not configured as Secure because the local deployment uses HTTP. Password hashing, login rate limiting, production secret management and an explicit CSRF protection strategy have not been implemented. Basic session and ownership checks make account-specific workflows demonstrable, but the authentication design is not suitable for public deployment.

Eatogether also lacks reporting, blocking, moderation, verified identities and in-app communication. The prototype can show a host, member list and participation state, but it cannot establish trust or safety between strangers. These are product and governance requirements for a real social dining pilot, with corresponding technical work still to be defined. Restaurant-hosted events and restaurant account types are intentionally outside the current application.

### Recommendation quality and scale

The ranking model is general-purpose and has not been trained on local dining outcomes. Descriptions and seeded party titles strongly influence its results. Negation, mixed-language preferences, dietary restrictions and unusual requests may not be handled reliably. The feature provides descriptive retrieval, not a verified dietary filter or a compatibility assessment between people.

Indexing changed descriptions happens within search requests, which can make first searches slower. Eligibility processing loads candidates into application memory, and exact vector ranking is sufficient only for the present scale without further measurement. Five-second polling also increases API and expiry-check traffic as more clients connect. Larger-scale work should first measure these costs, then consider background indexing, a scheduled expiry worker, query optimisation and event-driven updates where justified.

### Validation and operational readiness

The prototype has no restaurant attendance signal, payment event or confirmed meal-completion event. A past confirmed booking is therefore not evidence that diners attended or that restaurant revenue increased. There is no product analytics pipeline or tested retention measurement. These gaps should inform the later measurement plan rather than being filled with assumed results.

The next technical phase should begin with observed usability and retrieval issues, while preparing security and social safeguards before any public pilot. The current implementation supplies a functional basis for those evaluations: it supports multi-account party formation, host-controlled confirmation, consistent reservations and local semantic discovery. Evidence of desirability and business impact must come from the subsequent research and validation work.

## Technical References

Hugging Face. (n.d.). Use custom models. Transformers.js documentation. https://huggingface.co/docs/transformers.js/custom_usage

pgvector contributors. (n.d.). pgvector: Open-source vector similarity search for Postgres. https://github.com/pgvector/pgvector

PostgreSQL Global Development Group. (n.d.). Explicit locking. PostgreSQL 16 documentation. https://www.postgresql.org/docs/16/explicit-locking.html

Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using siamese BERT-networks. Proceedings of EMNLP-IJCNLP, 3982–3992. https://doi.org/10.18653/v1/D19-1410

Sentence Transformers. (n.d.). all-MiniLM-L6-v2 model card. https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

Xenova. (n.d.). all-MiniLM-L6-v2 ONNX model. Revision 751bff37182d3f1213fa05d7196b954e230abad9 used by the prototype. https://huggingface.co/Xenova/all-MiniLM-L6-v2

Implementation evidence: backend/src/dining.ts, discovery.ts, embeddings.ts and server.ts; backend/prisma/schema.prisma and migrations; frontend/src; docker-compose.yml; docs/TESTING.md; docs/DISCOVERY.md; and docs/SOURCES.md. Source snapshot: commit 524de60. Restaurant and asset provenance is recorded in docs/SOURCES.md, including the eight Eatigo branch pages and the OpenStreetMap attribution notice.
