# Eatigo Group Dining

## Purpose

SC4025 academic MVP extending Eatigo with diner-created shared tables. The implementation must support Chapter 5 of the report and demonstrate the team's product decisions. The supplied report is a work in progress, not evidence that its hypotheses are validated.

## Scope

- Responsive Eatigo-inspired web application with sourced real restaurant examples, local photos and simulated offers/bookings.
- Restaurant browsing, details, discount slots, ordinary bookings, group discovery, group details, creation, joining, leaving, host confirmation, cancellation, and personal bookings.
- Seeded diner accounts with an email/password login. No registration, password reset, OAuth, or customer/restaurant roles.
- Shared PostgreSQL state across browser sessions and LAN devices. Polling is sufficient.
- Everything runs on the Windows host through Docker Compose. No runtime cloud services.
- Restaurant-hosted events and restaurant dashboards are deferred outside the current scope.
- Semantic group-first discovery uses local MiniLM embeddings and PostgreSQL pgvector. Geographic distance and availability remain explicit filters. Swipe saves/skips; joining is separate. The map and venue assets are bundled locally.

## Booking rules

- The creator is the host and initially occupies one seat.
- Each member occupies one seat. Each user can have only one membership per group.
- A host can confirm once the restaurant slot's minimum party size is met, even if the group is not full.
- Confirmation closes joining and creates a single shared booking visible to all members.
- Members may leave before confirmation. The host cancels the group rather than leaving it.
- Membership is fixed after confirmation; the host may cancel the whole booking.
- Full groups await host confirmation; they do not automatically confirm.

## Engineering assumptions to keep explicit

- Model each reservation slot as one bookable table at one time, with minimum and maximum party size. Multiple tables can have distinct slot IDs.
- Creating a group holds that slot. Cancellation releases it. Ordinary bookings compete for the same slot.
- Open groups expire when their slot begins, releasing their hold. No payment or financial commitment is involved.
- Demo account credentials are public fixtures, checked on the backend. Browser sessions identify the authenticated user; clients cannot supply an arbitrary acting user ID.
- The prototype does not connect to Eatigo inventory or claim real reservations.

## Priorities

Demo reliability, coherent user flows, understandable code, straightforward local startup, responsive visual quality. Microservices, native apps, payments, chat and cloud deployment are outside the current scope.

## References and reporting

Assignment: report PDF up to 30 pages including references/appendices, font 11 and 1.5 spacing; presentation up to 30 minutes. Include contribution breakdown, repository URL, and literature review. Record actual tests, limitations, and design decisions as work progresses; do not invent research or validation results.

See docs/IMPLEMENTATION_PLAN.md for architecture, data model and API details.

- Product naming: the group dining feature is **Eatogether**. Map pins represent restaurants; selecting a restaurant reveals its available dining parties. No party counts on pins.
