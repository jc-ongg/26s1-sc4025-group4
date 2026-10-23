# Chapter 5 engineering evidence

This is the implementation evidence for the current report outline, updated for the 23 October 2026 Table 5 alignment. It supports Sections 5.1–5.4 and engineering input to 5.5. It does not replace the Product Analyst's usability study or supply invented participant results. Existing Word/PDF report artifacts and editable diagrams are not automatically rewritten by this app update.

## 5.1 System architecture and technology stack

The MVP is a three-tier web application deployed as three Docker Compose services on one host. Nginx serves the React application and proxies same-origin `/api` requests to Express. Express applies session, eligibility, ownership and booking rules, then reads/writes PostgreSQL. The browser does not connect directly to the database. Diner and restaurant viewpoints share the same backend and data; they are not separate products or databases.

| Layer                   | Technology and purpose                                                                                                                        | Source                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Browser                 | React 19, TypeScript, Vite and CSS; responsive views, menus, native dialogs, keyboard-accessible forms and reduced-motion support             | frontend/package.json, frontend/src                                                   |
| Web server              | Nginx static assets and API proxy; port 3000                                                                                                  | frontend/nginx.conf, frontend/Dockerfile                                              |
| API                     | Node.js 22, Express 5, TypeScript; modules for authentication, dining, lifecycle, merchant operations, social features and discovery          | backend/src/server.ts and related modules                                             |
| Persistence             | PostgreSQL 16 and Prisma 6 migrations/queries; slot row locks serialize seat allocation                                                       | backend/prisma/schema.prisma, backend/src/inventory.ts                                |
| Semantic discovery      | Local quantized MiniLM embeddings with 384 dimensions and pgvector cosine ranking, combined with menu/cuisine intent and relevance thresholds | backend/src/embeddings.ts, backend/src/discovery.ts, backend/src/discovery-ranking.ts |
| Deployment and delivery | Docker Compose; GitHub Actions validation and release packaging; manually approved local deployment                                           | docker-compose.yml, .github/workflows, scripts/deploy.ps1                             |

Images, maps and menu fixtures are bundled local assets/data. After image/model setup, core operation requires no cloud identity, map or image-hosting service. For you is a restaurant-only mood/location popup; the report's core EatTogether flow does not depend on it.

## 5.2 Data model and integrations

| Entity                                 | Role                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| User / Session                         | Credential identity, account role, fictional demographics, preverified fixture status, assigned restaurant and expiring HTTP-only session |
| Restaurant / ReservationSlot           | Venue, global/slot EatTogether participation, dining time, minimum, maximum table size, discounted seat pool and offer                    |
| GroupDiningSession / GroupDiningMember | Diner/Restaurant Event, immutable filters/theme, Host, one seat per account, individual price choice and private merchant attendance      |
| SlotAllocation / Booking               | Shared physical inventory and one persisted reservation per Event; ordinary reservations use the same pool                                |
| Notification / ReliabilityStrike       | Deduplicated in-app notices, private 90-day strike history and seven-day suspension                                                       |
| EventMessage / EventFeedback           | Persisted member/Restaurant Host Chat and optional six-question private feedback                                                          |
| DinerBlock / SafetyReport              | Silent exclusion and private pending safety reports; no moderation console                                                                |

Relevant relations: a restaurant has slots; each slot has bookings, allocations and Events; an Event has memberships, at most one allocation/booking, messages and feedback. A business account is assigned to one restaurant. The server resolves the acting account and venue from its session, never a client-supplied user or restaurant ID.

Integration boundary: Singpass/Corppass status is represented by **preverified fictional accounts**. Interactive mock verification is paused pending clarification; no identity API is integrated. No actual NRIC, government password or real UEN is collected. Email/password login works; registration/recovery/provider login buttons remain inactive. No Eatigo inventory, payment or restaurant ordering system is connected.

## 5.3 Core features implemented

### Discount access and shared reservations

Restaurants are the main collection, with three cards per page, shared grid/map views, nested Events and cuisine/price/discount/availability filters. An ordinary booking remains the default restaurant flow. EatTogether is an alternative for solo accounts below the minimum. Each account reserves one seat; friends Join separately. Eligible existing Events are offered before another Diner Event can be created at the same slot.

Slot allocations are updated inside PostgreSQL transactions under `SELECT ... FOR UPDATE`. Diner Events initially hold their minimum; Restaurant Events hold the whole configured table. Automatic confirmation produces one shared booking, retained across requalification and Host Handover. Business Hosts occupy no diner seat. A restaurant cannot change allocated slot prices or limits underneath existing bookings.

### Cutoff, Last Call and reliability

Cutoff is two hours before dining in Singapore time. It releases unused Held Seats and records a maximum headcount. Later Joins replace departures, without increasing that snapshot. The remaining capacity also depends on the shared pool; a snapshot is not a second independent inventory allocation. Short Events offer individual full-price acceptance/decline. A late departure below the minimum opens Last Call; refill preserves the booking reference, while unresolved undersubscription becomes full price at dining time. The worker reconciles transitions every 30 seconds, and authenticated reads/mutations also reconcile them under the slot lock.

Confirmed late Leaves require acknowledgement and record one private strike per account/Event/reason. Three strikes in 90 days suspend new EatTogether participation for seven days; ordinary booking stays available. Restaurant attendance opens after scheduled start. No-show recording is idempotent and correctable; correction removes the corresponding strike. Attendance below the minimum applies full price; correction can restore the agreed offer without overriding a Cutoff full-price acceptance.

### Trust, coordination and the restaurant viewpoint

Verified adult and immutable gender/age rules apply on the backend. Public participants show first name, exact fictional age and gender; birth dates, strikes, reports and individual Feedback stay private. Confirmed Chat permits current members and the Host of a Restaurant Event; merchants cannot read Diner Event Chat. Report/block tools appear on participants, messages and unsafe Feedback answers. Report review remains on hold.

Restaurant login opens a venue-scoped dashboard with Reservations, EatTogether and Slots. Staff can enable/exclude new Events, edit unallocated future slot settings, create Restaurant/Themed Events, record attendance and inspect their own Restaurant Events' aggregate Feedback. Recommended menu previews show original and discounted SGD prices using local illustrative fixtures. The Event name may identify a table; there is no physical table-allocation model.

Feedback opens after scheduled dining time with an attendance attestation, not an explicit completed-meal workflow. It contains overall experience, safety, social experience, meal rating, willingness to dine again and optional suggestions. Somewhat/No on safety exposes report/block. An in-app invitation after two hours is a reminder convention, not proof of attendance or meal completion.

## 5.4 Requirement to implementation traceability

| Report task | Design entry point                                                | Implementation / verification                                                                 |
| ----------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1 / RT1    | Interactive verification paused; preverified accounts remain      | No verification-completion claim in this build                                                |
| D2          | Restaurant's nested Event → one-seat Join                         | RestaurantPages.tsx, RestaurantBooking.tsx, dining.ts, table-five.test.ts                     |
| D3 / RT3    | Diner filters / explicitly themed Restaurant Event filters        | EventPreferences.tsx, BusinessApp.tsx, event-eligibility.ts, dining.test.ts, business.test.ts |
| D4 / RT4    | Visible Cutoff date/time, price choices and merchant seat summary | GroupPages.tsx, BusinessApp.tsx, event-lifecycle.ts, lifecycle.test.ts                        |
| D5 / D6     | Last Call inbox entry, replacement Join, acknowledged late Leave  | Notifications.tsx, GroupPages.tsx, event-lifecycle.ts, reliability.ts, lifecycle.test.ts      |
| D7          | History → six-question Feedback → safety tools                    | EventSocial.tsx, social.ts, lifecycle.test.ts, table-five.test.ts                             |
| RT2         | Assigned venue → six-seat Restaurant Event, minimum four, 40%     | BusinessApp.tsx, business.ts, business.test.ts, table-five.test.ts                            |
| RT5         | Restaurant Host Chat and historical Feedback averages             | EventSocial.tsx, BusinessApp.tsx, business.ts, table-five.test.ts                             |

## 5.5 Engineering testing and limitations

Use `npm test`, `npm run typecheck`, `npm run format:check` and `npm run ci:integration`. The integration command creates an isolated Compose project and database, exercises HTTP authentication, PostgreSQL transactions, the ten non-verification Table 5 paths and the local recommendation model, then removes only its own resources. `npm run demo:prepare` prepares resettable scenarios for human testing; see TABLE_5_WALKTHROUGH.md. Test timestamps, final counts and actual browser observations are recorded in TESTING.md. A local check is not a new GitHub Actions run; a successful workflow is not evidence that every possible bug has been eliminated.

The fixtures are synthetic evidence of program behaviour, not human usability outcomes. Do not fill task success rates, SEQ, SUS, perceived safety or willingness-to-opt-in with automated test results or the seeded historical ratings. Table 6 and the issue log require actual participant observations. The report should distinguish its planned weekly-completed-meals metric from implemented reservation/attendance data; no validated analytics dashboard exists.

Technical limits: public demo credentials and preverified identity fixtures, a small catalogue, fixed age/gender identity fixtures, illustrative menus/offers, polling rather than push/WebSockets, no real inventory/payment integration, no physical floor plan, no human moderation/appeal process, no Connections feature and no production security/scale claim. D1 and RT1 remain excluded while verification is paused; the other ten Table 5 tasks are supported.
