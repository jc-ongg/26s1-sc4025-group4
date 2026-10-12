# EatTogether implementation scope

Current diner scope: 12 October 2026. Restaurant management remains paused pending the team's decision. The technical report and editable diagrams describe shared inventory, lifecycle rules, unified discovery and continuous delivery with manual deployment. Sections 5.1 and 5.2 remain reserved for later product work. See CONCEPT_ALIGNMENT.md for the latest diner-side audit and subsequent interface/search changes.

## Seats and eligibility

Each account reserves one EatTogether seat; friends Join separately. Ordinary bookings retain party size. Existing multi-diner records are preserved and can explicitly shrink to one seat. Verified adult eligibility and optional immutable age/gender preferences apply to discovery and Joins. Seeded Singpass identities are fictional; only credential login works.

Slots have a minimum, a maximum table size and a shared seat pool (`discountedSeats`, falling back to capacity for existing slots). New seed slots offer two tables' worth of seats, using synthetic restaurant limits. Ordinary bookings and Events share that pool under the same row lock. Each Event represents one table and stays within the maximum table size. Full-price bookings continue to occupy physical seats; removing the discount does not free their inventory.

Creation holds the minimum seats. Additional Joins draw from free pool inventory. Displayed Event Capacity is bounded by the table limit and its own hold plus free seats. New Events close at Cutoff, two hours before dining. A diner must Join an eligible existing Event with room before creating another at that slot. An account cannot hold two active Event seats at the same slot.

Hidden Events expose no identifiers or participant data, while free seats at that slot remain bookable. Public participants expose names, exact ages and gender; birth dates, reliability records, reports, blocks, individual price choices and feedback are private. Participant cards show role, age and gender rather than repeating the single-seat count. Own memberships/history remain accessible. The six verified demo identities are aged 21–26 in October 2026. These fictional birth dates represent preverified identity data; the MVP does not retrieve data from Singpass.

Discovery has one restaurant collection with at most three cards per page and a Restaurant view / Map view toggle. Each venue contains a compact EatTogether section; the grid and map share the same Event information and one-at-a-time navigation. Counts consistently show Restaurants and matching EatTogether Events. Cuisine, price-band, minimum-discount and EatTogether availability filters apply to both views. Discounts are checked separately for ordinary slots and Events: a high-discount ordinary slot cannot qualify a lower-discount Event for the EatTogether filter. For you stays a restaurant-only popup, opened from the right of the search toolbar. Legacy Event-list links open restaurant discovery with the Events filter selected.

Booking details remain exclusively in Bookings. Profile contains identity, reliability/settings and notification history. The bell contains unread notifications; marking one as read removes it from the bell but keeps it in history. Both feeds use the same three-item pagination and render the latest 100 visible notifications supplied by the existing API. The reliability policy remains available through an information tooltip.

## Timing and reservations

| State               | Behaviour                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waiting for diners  | Before Cutoff, hold at least the minimum. Confirmation is automatic at minimum; falling below it makes an existing booking pending.                                                                                                            |
| Confirmed           | Joins remain open until dining time, subject to pool and table limits. Requalification reuses the booking reference.                                                                                                                           |
| Action needed       | At Cutoff, a short Event releases unused Held Seats. Each member accepts full price or declines without penalty before dining time. Joins close.                                                                                               |
| Full price          | Accepted members retain a full-price reservation. Unanswered choices expire at dining time. No discount is shown.                                                                                                                              |
| Last Call           | A late departure drops a confirmed Event below minimum. Nearby eligible diners receive in-app invitations. Remaining members can Leave without penalty. Refill restores the discount and booking; otherwise full price applies at dining time. |
| Cancelled / Expired | Inventory is released. Started confirmed/full-price reservations remain in history, with membership changes closed.                                                                                                                            |

Host departure hands over to the earliest member, using user ID to break timestamp ties. An empty Event cancels. Explicit Host cancellation releases the whole Event and informs members. The lifecycle runs every 30 seconds and on authenticated requests; detail reads and mutations reconcile their Event under its slot lock. Restart catches up due transitions without duplicate bookings/notices.

## Reliability and social tools

A confirmed late Leave after Cutoff requires acknowledgement and records a private strike, deduplicated per account/Event/reason. Three strikes within 90 days suspend new EatTogether creation and Joins for seven days; ordinary booking remains available. Last Call, full-price and blocked-diner departures are penalty-free. No-show penalties wait for restaurant attendance evidence.

The notification bell contains persisted confirmations, member changes, Handover, cancellation, Cutoff, Last Call and reliability updates. Waiting Events send at most one reminder per Singapore calendar day, including creation day. Nearby invitations require an optional Profile neighbourhood within 5 km, using a static local coordinate catalogue. There is no GPS lookup, email, SMS or delivery while the app is closed. Stale/ineligible Last Call invitations are hidden.

Chat opens once confirmed, including an accepted full-price reservation. Only current members can read/send. Cancelled/expired Chat is read-only; leaving removes access. The latest 200 messages appear as plain text, with blocked authors hidden. Safety options are available on other diners' messages as well as participant cards and unsafe Feedback answers. Blocking requires a confirmation that explains future Event exclusion and penalty-free departure.

Report and Block are inside Events. Reports are private pending records; no moderation console or automatic punishment exists. Blocking is silent, hides future Events containing either account, and can be undone in Profile. Existing shared reservations remain accessible for safe departure.

Optional private Feedback opens after the scheduled start of a confirmed/full-price booking. It asks about overall experience, safety, social experience, meal, dining again and suggestions, with three keyboard-accessible star scales. A diner must attest attendance; this is self-report, not restaurant verification. A once-per-Event in-app invitation arrives two hours after scheduled start. That delay is a reminder convention, not proof of completion. Skipping has no reliability effect. Unsafe answers expose report/block. Only the submitting diner can read/edit a response.

For you uses dining mood and optional typed location (within 15 km), with no cuisine dropdown. Food spellings and menu synonyms are normalized; typed cuisines/menu items constrain semantic ranking. Weak semantic matches are rejected using an absolute score floor and relative band, with at most six results. Fresh searches do not hide previously saved/skipped restaurants. Saved venues are marked, and advancing past one does not remove it from the shortlist. Cosine similarity is not shown as a confidence percentage.

Explicit navigation, filters, pagination, menus, modals and restaurant Event disclosures have short transitions. Background refreshes preserve focus/selection without repeated entrance effects. Reduced-motion preferences disable motion, including explicit mobile scroll assistance.

## Interface and deferred scope

Restaurants form one main collection with nested EatTogether Events, shared grid/map views and availability filters. For you is a restaurant-only popup. Book | EatTogether lives inside restaurant booking. My bookings has private reservations left and Events right, two per page. Profile retains notification history without duplicating booking details. Chat, Feedback, dining area and blocked diners are collapsed disclosures.

Deferred: restaurant accounts/portal, Restaurant Events, Corppass, merchant slot-management controls, verified attendance, no-show penalties, moderation/appeals, payments, mutual Connections, real Singpass, registration and password reset. Slot-level EatTogether eligibility exists as data, with no merchant editor yet. Do not claim deferred features in the report.
