# Eatigo Group Dining

## Purpose

SC4025 academic MVP extending Eatigo with diner-created shared tables. The implementation must support Chapter 5 of the report and demonstrate the team's product decisions. The supplied report is a work in progress, not evidence that its hypotheses are validated.

## Scope

- Responsive Eatigo-inspired web application with sourced real restaurant examples, local photos and simulated offers/bookings.
- Restaurant browsing, details, discount slots, ordinary bookings, Event discovery and creation, single-diner joining and leaving, automatic confirmation, Host Handover, cancellation, and personal bookings.
- Seeded diner accounts with an email/password login. No registration, password reset, OAuth, or customer/restaurant roles.
- Shared PostgreSQL state across browser sessions and LAN devices. Polling is sufficient.
- Everything runs on the Windows host through Docker Compose. No runtime cloud services.
- Restaurant-hosted events and restaurant dashboards are deferred outside the current scope.
- Semantic restaurant/Event discovery uses local MiniLM embeddings and PostgreSQL pgvector. Geographic distance and availability remain explicit filters. Swipe saves/skips; joining is separate. The map and venue assets are bundled locally.

## Booking rules

- An Event combines individually booked diners at one restaurant slot. Each account represents one Solo Diner in new EatTogether reservations.
- Each account reserves one EatTogether seat. Friends need separate accounts and Join the same Event individually. New Events and Joins require a slot minimum above one. Existing multi-diner records are preserved; their owner may explicitly reduce them to one seat. Ordinary reservations retain their party-size choice.
- The creator is the Host. Total diners across Parties determine occupancy and confirmation, rather than the number of accounts.
- Confirmation is automatic when the minimum is reached. The shared reservation stays open to Joins and Leaves until dining time, subject to capacity. Owners of older multi-diner reservations may explicitly reduce them to one seat.
- Falling below the minimum restores Undersubscribed status. An existing reservation becomes PENDING and disappears from Reservations until the minimum is met again; its booking ID is retained.
- The Host can Leave. The earliest remaining Joining Party becomes Host, and shared-booking ownership moves with that role. Equal join timestamps use user ID as a deterministic tie-break.
- If the last Party Leaves, the Event is cancelled and its table hold is released. The Host also retains the existing explicit whole-Event cancellation action, separate from Leave.
- At dining time, Undersubscribed Events expire and release their hold. Confirmed Events remain as reservation history. Joining, leaving and resizing are closed once dining starts.
- See docs/EATTOGETHER_SCOPE.md for alignment with the product lead's concept and deferred decisions.

## Engineering assumptions to keep explicit

- Model each reservation slot as one bookable table at one time, with minimum and maximum party size. Multiple tables can have distinct slot IDs.
- Creating a group holds that slot. Cancellation releases it. Ordinary bookings compete for the same slot.
- Undersubscribed Events expire when their slot begins, releasing their hold. No payment or financial commitment is involved.
- Demo account credentials are public fixtures, checked on the backend. Browser sessions identify the authenticated user; clients cannot supply an arbitrary acting user ID.
- The prototype does not connect to Eatigo inventory or claim real reservations.

## Priorities

Demo reliability, coherent user flows, understandable code, straightforward local startup, responsive visual quality. Microservices, native apps, payments, chat and cloud deployment are outside the current scope.

## References and reporting

Assignment: report PDF up to 30 pages including references/appendices, font 11 and 1.5 spacing; presentation up to 30 minutes. Include contribution breakdown, repository URL, and literature review. Record actual tests, limitations, and design decisions as work progresses; do not invent research or validation results.

See docs/IMPLEMENTATION_PLAN.md for architecture, data model and API details.

- Product naming: the group dining feature is **EatTogether**. Map pins represent restaurants; selecting a restaurant reveals its available Events. No party counts on pins.
