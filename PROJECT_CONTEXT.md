# Eatigo Group Dining

## Purpose

SC4025 academic MVP extending Eatigo with diner-created shared tables. The implementation must support Chapter 5 of the report and demonstrate the team's product decisions. The supplied report is a work in progress, not evidence that its hypotheses are validated.

## Scope

- Responsive Eatigo-inspired web application with sourced real restaurant examples, local photos and simulated offers/bookings.
- Restaurant browsing, details, discount slots, ordinary bookings, Event discovery and creation, single-diner joining and leaving, automatic confirmation, Host Handover, cancellation, and personal bookings.
- One restaurant collection supports grid/map views, three cards per page, combined Restaurant/Event counts, and cuisine, price-band, minimum-discount and EatTogether availability filters. Each restaurant contains its Events; there is no separate EatTogether collection. For you opens from the right of the search toolbar. Profile shows identity/settings and notification history; the bell shows unread messages. Booking details stay in Bookings.
- Seeded diner accounts with an email/password login. Registration, password reset and real provider login are inactive. Separate business accounts manage their assigned restaurant. Interactive mock verification is paused.
- Shared PostgreSQL state across browser sessions and LAN devices. Polling is sufficient.
- Everything runs on the Windows host through Docker Compose. No runtime cloud services.
- Restaurant-hosted Events, Themed Events, slot controls, attendance and aggregate Restaurant Event Feedback are implemented in the same app.
- For you is restaurant-only with mood and optional typed location. Local MiniLM/pgvector ranking combines normalized menu/cuisine intent with relevance thresholds; weak searches are empty rather than padded. Geographic distance and availability remain explicit constraints. Saved venues are marked in fresh searches; skips dismiss a deck rather than permanently hiding restaurants. Joining is separate. The map and venue assets are bundled locally.

## Booking rules

- An Event combines individually booked diners at one restaurant slot. Each account represents one Solo Diner in new EatTogether reservations.
- Each account reserves one EatTogether seat. Friends need separate accounts and Join the same Event individually. New Events and Joins require a slot minimum above one. Existing multi-diner records are preserved; their owner may explicitly reduce them to one seat. Ordinary reservations retain their party-size choice.
- EatTogether creation/Join requires a verified adult with a stored birth date and gender. Six demo accounts have fictional preverified identity fixtures; real Singpass authentication remains disabled. Optional age/gender preferences are immutable and must include the Host. Ages are checked at dining time using Singapore dates, with adulthood required already at the time of the request.
- Only eligible Events enter discovery, map/card counts, saved items and direct-link reads. Hidden Event identifiers are concealed while free seats in the shared pool remain bookable. Existing members retain history access. Public participants expose exact ages and gender; birth dates and account credentials remain private. The six fictional verified identities are aged 21–26 in October 2026.
- The creator is the Host. Total diners across Parties determine occupancy and confirmation, rather than the number of accounts.
- Confirmation is automatic when the minimum is reached. The shared reservation stays open to Joins and Leaves until dining time, subject to capacity. Owners of older multi-diner reservations may explicitly reduce them to one seat.
- Before Cutoff, falling below the minimum restores Waiting for diners. An existing reservation becomes PENDING until requalification, retaining its ID. After Cutoff, undersubscribed confirmed Events enter Last Call; short unconfirmed Events offer full-price acceptance/decline.
- The Host can Leave. The earliest remaining Joining Party becomes Host, and shared-booking ownership moves with that role. Equal join timestamps use user ID as a deterministic tie-break.
- If the last Party Leaves, the Event is cancelled and its table hold is released. The whole-Event cancellation button is removed; Leave performs Handover. The legacy cancellation API remains for compatibility.
- At dining time, unanswered full-price choices expire. Accepted full-price and confirmed bookings remain as history; unfilled Last Call reservations revert to full price. Membership changes close once dining starts.
- See docs/EATTOGETHER_SCOPE.md for alignment with the product lead's concept and deferred decisions.

## Engineering assumptions to keep explicit

- Slots provide shared seat pools and a separate maximum table size. Each Event is one table; ordinary bookings draw from the same pool. Row locks serialize allocations and timing transitions.
- Cutoff is two hours before dining. Short Events offer per-account full-price acceptance or penalty-free decline. Late undersubscription opens Last Call. See docs/EATTOGETHER_SCOPE.md for current rules, superseding earlier lifecycle assumptions above.
- Late-Leave reliability, private reports/blocks, member Chat, optional post-time feedback and persisted in-app notifications are implemented. Restaurant-recorded no-show penalties and corrections are implemented.
- Demo account credentials are public fixtures, checked on the backend. Browser sessions identify the authenticated user; clients cannot supply an arbitrary acting user ID.
- The prototype does not connect to Eatigo inventory or claim real reservations.

## Priorities

Demo reliability, coherent user flows, understandable code, straightforward local startup, responsive visual quality. Microservices, native apps, payments and cloud deployment are outside the current scope. Restaurant-side work is implemented; interactive identity verification and report moderation remain paused. The technical report was refreshed on 11 October; later app refinements are recorded in docs/CONCEPT_ALIGNMENT.md until another report update is requested.

## References and reporting

Assignment: report PDF up to 30 pages including references/appendices, font 11 and 1.5 spacing; presentation up to 30 minutes. Include contribution breakdown, repository URL, and literature review. Record actual tests, limitations, and design decisions as work progresses; do not invent research or validation results.

See docs/IMPLEMENTATION_PLAN.md for architecture, data model and API details.

- Product naming: the group dining feature is **EatTogether**. Map pins represent restaurants; selecting a restaurant reveals its available Events. No party counts on pins.
