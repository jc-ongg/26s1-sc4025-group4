# EatTogether concept alignment

This update implements the scope approved on 3 October 2026 against the product lead's _EatTogether Feature Concept for Team Review_. It is a partial alignment, rather than a claim that the full concept is implemented.

## Implemented rules

| Concept                   | Implementation                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Party / Event distinction | For new EatTogether reservations, one account represents one Solo Diner. Friends Join separately; an Event aggregates their individual seats.                      |
| Eligibility               | New Event creation and Joins reserve exactly one seat and require a slot minimum above one. Existing multi-diner reservations may only be reduced to one seat.     |
| Held seats                | Sum the diner counts across Parties; account count is not occupancy. All cards, map details and recommendations use this count.                                    |
| Automatic confirmation    | At the slot minimum, create or update one shared confirmed booking. The Host does not manually confirm.                                                            |
| Continued participation   | Before dining time, Confirmed Events accept eligible single-diner Joins and Leaves, up to capacity. Older multi-diner reservations may be reduced to one seat.     |
| Reversion                 | Below the minimum, show Undersubscribed and mark an existing booking PENDING. Reservations exclude pending bookings; requalification reuses the booking reference. |
| Host Handover             | When the Host Leaves, the earliest remaining Party becomes Host and owns the shared booking. Equal timestamps use user ID as a stable tie-break.                   |
| Empty Event               | Cancel and release the held table when the final Party Leaves.                                                                                                     |
| Slot discovery            | Restaurant slots show EatTogether availability and open an existing Event for that time instead of offering duplicate creation. Ordinary Book remains the default. |

As of 4 October 2026, Events and local semantic recommendations open within the restaurant homepage. The separate EatTogether navigation tab is removed. Restaurant cards highlight available EatTogether seats, and slots still open an existing Event. The ranking model and saved-card behaviour are unchanged.

The account menu contains Profile, Bookings and Logout. Profile shows personal details, past confirmed reservations and a private Reliability Score record starting at zero strikes. Automatic strike tracking is not enabled: Cutoff, attendance evidence and penalty rules remain deferred. A past reservation means its scheduled start time has passed; it does not prove attendance.

As of 8 October 2026, new EatTogether reservations use one account per diner. The API rejects multi-diner creation, Joins and increases through the resize endpoint. Existing records are not automatically rewritten; owners can reduce an older reservation to their own seat. Verification and demographic eligibility remain deferred. Ordinary bookings retain their party-size choice.

## Existing MVP behaviour retained

Each slot represents one table, held exclusively by either an ordinary booking or an Event. Event capacity defaults to the slot capacity. The API retains its optional capacity field for existing clients; it must remain between the slot minimum and maximum. This is not a shared seat-pool implementation.

An Undersubscribed Event expires at dining time. A Confirmed Event remains as booking history; no membership changes are accepted once dining starts. The Host retains explicit whole-Event cancellation before dining time, separate from Leave and Handover. There is no full-price fallback, payment or real restaurant reservation.

The earlier Party-size migration gave existing memberships a size of one. Startup reconciles future active Events into automatic confirmation without recreating their records. Past reservations are preserved. New demo slots at Seorae and Yan Lai Ju have a four-diner minimum and six-diner capacity; these now require four individual accounts to demonstrate confirmation. These are synthetic limits, not claims about those restaurants' policies; existing slots keep their original values.

## Deferred product decisions

- Shared discounted-seat pools, variable capacity and competing Events: define allocation and release rules, whether ordinary bookings draw from the same pool, and how one Event maps to one physical table.
- Cutoff, Last Call and full-price fallback: define timings, which changes trigger each state, Party-level choices, and the final reservation outcome.
- Age/gender/profile filters and verification: define required data, eligibility rules, permitted filters and verification behaviour.
- Chat and moderation: define access windows, report/block effects and moderation ownership.
- Reliability strikes and suspension: define what counts as a strike, late-change windows, no-show evidence, exceptions and appeals.

Do not represent these deferred rules as implemented in the technical report. The existing Section 5 Word document and diagrams predate this lifecycle update and need revision when the final report scope is settled.

## Restaurant booking flow

The restaurant detail page follows date, time, Party size and **Book | EatTogether**. Book is the default for an unreserved time. Existing Events for the selected date appear alongside the time selection; choosing an Event previews it in the booking panel. Eligible Parties can Join there, existing members can manage their Event, and full Events remain visible. Joining reserves one seat for the signed-in account; friends Join with their own accounts. New Event creation opens only after an explicit **Start an EatTogether Event** choice and is unavailable when an Event already holds the table or the Party qualifies to book directly.

My bookings separates private reservations on the left from EatTogether Events on the right. Shared reservation references and personal cancelled-booking deletion are shown in the Event list, so a confirmed Event is not duplicated. Profile totals and past history continue to include both booking kinds. Upcoming, Past, Cancelled, Waiting for diners and Expired retain written labels alongside colour cues. Past means the scheduled start has passed, rather than verified attendance. Leaving requires confirmation explaining requalification and possible Host Handover. No deferred eligibility, Cutoff or penalty policy is added.
