# EatTogether concept alignment

This update implements the scope approved on 3 October 2026 against the product lead's _EatTogether Feature Concept for Team Review_. It is a partial alignment, rather than a claim that the full concept is implemented.

## Implemented rules

| Concept                   | Implementation                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Party / Event distinction | One account represents one Party with a size of 1–20 diners. An Event aggregates Parties at a restaurant slot.                                                     |
| Eligibility               | New Parties creating or Joining must be smaller than the slot minimum. Parties meeting the minimum book directly. Existing Parties may resize within capacity.     |
| Held seats                | Sum the diner counts across Parties; account count is not occupancy. All cards, map details and recommendations use this count.                                    |
| Automatic confirmation    | At the slot minimum, create or update one shared confirmed booking. The Host does not manually confirm.                                                            |
| Continued participation   | Before dining time, Confirmed Events accept eligible Joins, Leaves and resizing, up to capacity.                                                                   |
| Reversion                 | Below the minimum, show Undersubscribed and mark an existing booking PENDING. Reservations exclude pending bookings; requalification reuses the booking reference. |
| Host Handover             | When the Host Leaves, the earliest remaining Party becomes Host and owns the shared booking. Equal timestamps use user ID as a stable tie-break.                   |
| Empty Event               | Cancel and release the held table when the final Party Leaves.                                                                                                     |
| Slot discovery            | Restaurant slots show EatTogether availability and open an existing Event for that time instead of offering duplicate creation. Ordinary Book remains the default. |

The existing EatTogether discovery tab and local semantic recommendations are retained. Only eligibility and occupancy were adapted; the ranking model and saved-card behaviour were not redesigned.

## Existing MVP behaviour retained

Each slot represents one table, held exclusively by either an ordinary booking or an Event. Event capacity defaults to the slot capacity. The API retains its optional capacity field for existing clients; it must remain between the slot minimum and maximum. This is not a shared seat-pool implementation.

An Undersubscribed Event expires at dining time. A Confirmed Event remains as booking history; no membership changes are accepted once dining starts. The Host retains explicit whole-Event cancellation before dining time, separate from Leave and Handover. There is no full-price fallback, payment or real restaurant reservation.

Migration gives existing Party memberships a size of one. Startup reconciles future active Events into automatic confirmation without recreating their records. Past reservations are preserved. New demo slots at Seorae and Yan Lai Ju have a four-diner minimum and six-diner capacity to demonstrate multiple diners per Party. These are synthetic limits, not claims about those restaurants' policies; existing slots keep their original values.

## Deferred product decisions

- Shared discounted-seat pools, variable capacity and competing Events: define allocation and release rules, whether ordinary bookings draw from the same pool, and how one Event maps to one physical table.
- Cutoff, Last Call and full-price fallback: define timings, which changes trigger each state, Party-level choices, and the final reservation outcome.
- Age/gender/profile filters and verification: define required data, eligibility rules, permitted filters and verification behaviour.
- Chat and moderation: define access windows, report/block effects and moderation ownership.
- Reliability strikes and suspension: define what counts as a strike, late-change windows, no-show evidence, exceptions and appeals.

Do not represent these deferred rules as implemented in the technical report. The existing Section 5 Word document and diagrams predate this lifecycle update and need revision when the final report scope is settled.
