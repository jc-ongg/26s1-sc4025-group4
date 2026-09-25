# Testing

## Automated checks

Run formatting and TypeScript checks from the repository root:

```powershell
npm run format:check
npm run typecheck
npm test
```

With the Docker stack running:

```powershell
npm run test:integration
docker compose exec -T backend npm run test:integration
docker compose exec -T backend npm run test:discovery
```

The root integration script exercises authentication through port 3000. Backend integration tests use the real PostgreSQL database and API; each process creates and removes its own fixtures. Never run these suites against a production database.

| Suite                     | Coverage                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication unit tests | Credential normalization, missing and malformed inputs                                                                                                                                                   |
| HTTP authentication       | Readiness, safe user fields, independent sessions, logout revocation                                                                                                                                     |
| Dining integration        | Input validation, host authorization, confirmation below capacity, membership freeze, concurrent last-seat joins, competing ordinary/group reservations, expiry, personal deletion of cancelled bookings |
| Discovery integration     | Real-model semantic rankings, radius filtering, available seats, per-account decisions, save/skip/undo                                                                                                   |

## Browser verification

Check restaurant browsing and photo-map selection at desktop and phone widths. Exercise Eatogether → For you, swipe/save/undo, and the shortlist. My bookings should show two compact, independently paginated lists, with Upcoming/History filters and personal deletion for cancelled bookings.

Use separate browser profiles or devices for the two-account flow in [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md). Verify that a second diner joining updates the host's screen within the polling interval, and that host confirmation creates one shared booking.

## Recorded coverage

On 25 September 2026, both Docker builds, the credential unit tests, HTTP authentication checks, all six dining integration tests and the discovery integration test passed. Desktop and phone-sized browser checks covered navigation, map controls, recommendation decisions, pagination, filters and overflow. A separate model invocation with Docker networking disabled returned a 384-dimensional embedding.

Physical second-device connectivity depends on the network and has not been independently verified. These checks establish engineering behaviour on the demonstration dataset, not usability findings or broad recommendation quality. Participant testing and a held-out semantic-versus-keyword benchmark remain separate evaluation work.
