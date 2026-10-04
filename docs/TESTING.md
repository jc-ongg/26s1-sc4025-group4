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

| Suite                     | Coverage                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication unit tests | Credential normalization, missing and malformed inputs                                                                                                                                                                                                                          |
| Frontend unit tests       | Proxy errors, malformed responses, request cancellation, timeouts without duplicate writes, and available-slot/party start-time boundaries                                                                                                                                      |
| HTTP authentication       | Readiness, safe user fields, independent sessions, logout revocation                                                                                                                                                                                                            |
| Dining integration        | Input validation, host authorization, automatic confirmation/reversion, weighted Party counts, Host Handover, changes after confirmation, start-time freeze, concurrent last-seat joins, competing ordinary/group reservations, expiry, personal deletion of cancelled bookings |
| Discovery integration     | Real-model semantic rankings, radius filtering, available seats, per-account decisions, save/skip/undo                                                                                                                                                                          |

## Isolated CI integration

`npm run ci:integration` builds and tests a fresh Docker stack on port 3001, then removes only its temporary project resources. This is the same integration entry point used by GitHub Actions. It does not test against or reset the local demo database. See [CI_CD.md](CI_CD.md) for the workflow, evidence and release process.

## Browser verification

Check restaurant browsing and photo-map selection at desktop and phone widths. Open For you from restaurant discovery and exercise swipe/save/undo and the shortlist. Changing search mode or preferences must clear the previous results. My bookings should show two compact, independently paginated lists, with Upcoming/History filters and personal deletion for cancelled bookings. Page headings should remain visible after navigating between tabs and loading detail pages.

For connection recovery, disconnect and reconnect the browser's network while a list is open. Existing content should stay visible with a readable error; polling resumes after reconnecting or returning to a visible tab. If a write times out, refresh to check whether it completed before retrying. Writes are never automatically retried.

Use separate browser profiles or devices for the two-account flow in [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md). Verify that a second diner joining updates the host's screen within the polling interval, and that reaching the minimum automatically creates one shared booking. Shrink below the minimum and restore it, then check that the same booking ID returns. Verify Host Handover and the slot-level View Event shortcut.

## Recorded coverage

On 25 September 2026, both Docker builds, the credential unit tests, HTTP authentication checks, all six dining integration tests and the discovery integration test passed. Desktop and phone-sized browser checks covered navigation, map controls, recommendation decisions, pagination, filters and overflow. A separate model invocation with Docker networking disabled returned a 384-dimensional embedding.

On 28 September 2026, both Docker builds, TypeScript checks, the two credential tests, seven frontend tests, HTTP authentication checks, all six dining integration tests and the discovery integration test passed. Discovery coverage now also verifies restaurant search as the API default. Browser checks covered clearing results when switching search mode, save/shortlist/undo, past-party action visibility, and navigation at desktop and phone widths.

A subsequent Chrome compatibility fix on the same day removed dependencies on `AbortSignal.any`, `AbortSignal.timeout` and `throwIfAborted`. The frontend suite now has nine passing tests; all API cases run with those helpers disabled, covering successful page reads, cancellation before a request starts, late-response cancellation, timeouts and listener cleanup.

Physical second-device connectivity depends on the network and has not been independently verified. These checks establish engineering behaviour on the demonstration dataset, not usability findings or broad recommendation quality. Participant testing and a held-out semantic-versus-keyword benchmark remain separate evaluation work.

On 3 October 2026, the Party-size migration applied successfully to the existing local database. Both Docker builds, formatting and TypeScript checks, the two credential tests, ten frontend tests, HTTP authentication checks, all nine dining integration tests and the real-model discovery test passed. Dining coverage now includes weighted Party counts, invalid new-Party sizes, duplicate joins without resizing, automatic confirmation and reversion with a stable booking ID, pending-booking expiry, concurrent multi-diner joins, Host Handover, last-Party table release and start-time closure.

Browser verification covered default Book mode, Party-size creation, the slot-level View Event shortcut, two Parties of two triggering confirmation, shrink/requalification, pending reservations hidden while Events remain visible, Host Handover and final-Party cancellation. A 390-pixel phone viewport showed no horizontal overflow. The temporary browser Event and integration fixtures were removed; existing slots and user records were preserved. See [EATTOGETHER_SCOPE.md](EATTOGETHER_SCOPE.md) for the approved partial alignment.

Further checks on 3 October 2026 verified the presentation clarity changes. The frontend suite now has thirteen tests, including quiet initial/unchanged reads, weighted pending progress and combined confirmation/Handover updates. All nine PostgreSQL integration tests pass with added assertions that each account receives its own Party size alongside the Event total, ordinary reservations retain their Party size, and an empty cancelled Event does not invent a personal count.

Browser checks verified the rehearsed Korean semantic query, creation, confirmation received through polling from another account, pending progress in My bookings, unchanged reservation references across requalification, Handover notification to the new Host, and rejoining to finish confirmed. At 390 pixels the lists still contain two rows each, with no horizontal or card overflow. Notices overlay the page without moving the controls, can be dismissed and close after ten seconds. Only the new rehearsal fixture was removed. Presentation timing is a recommended allocation rather than a measured result; see [PRESENTATION_DEMO.md](PRESENTATION_DEMO.md).

On 4 October 2026, the six renamed demo accounts passed HTTP authentication checks, including independent sessions and logout revocation. The four legacy accounts retain their original user IDs; existing memberships and bookings were preserved. All ten dining integration tests and the two credential tests passed. A new integration test verifies account-specific profile reads, authentication and absence of private strike counts from public Event participants. Sixteen frontend tests now include exact start-time boundaries, cancelled/pending reservation exclusion, future unconfirmed Events, past confirmed history, and ascending Upcoming versus descending History order.

Browser checks covered the Login/Register interface, disabled recovery and registration controls, the account menu, Profile history and its private zero-strike Reliability Score record, Upcoming filtering, embedded semantic search, Event discovery and the offline map. A 390-pixel viewport showed no horizontal or booking-card overflow and two rows per booking list. The document scroll-snap setting is none. On a short page, the footer bottom matched the 720-pixel viewport bottom. The private strike counter starts at zero. No attendance verification, automatic strike tracking or suspension rules are implemented.

A further booking-flow revision on 4 October 2026 passed both Docker builds, TypeScript checks, the two credential tests, twenty frontend tests, HTTP authentication checks and all ten dining integration tests. New coverage checks whole-Party joining eligibility, remaining seats, closed/inactive Events, discoverable Event-held slots, and consistent Upcoming/Past display boundaries. Database assertions verify that confirmed Events remain discoverable at their restaurant and cancellation removes the Event from current slot discovery while releasing the allocation.

Browser verification used three isolated future slots and two accounts to create an Event, discover and Join it directly from the restaurant, confirm automatically, shrink/requalify with the same booking reference, and create/cancel a separate private reservation. My bookings displayed each shared reservation only in the EatTogether list. Checks also covered a full Event remaining selectable, members seeing their actual Party size, a Stay/Confirm leave prompt, Host Handover with a live notice and stable reference, and final-Party cancellation. At 390 pixels, explicit time selection revealed the booking panel; the panel and compact history cards had no horizontal overflow, and history pagination retained a maximum of two rows per list. Past and Expired displayed their respective green and grey badges; cancellation showed red. Only the three named browser fixtures and their associated records were removed. Existing records were preserved.

The login account disclosure is removed; credentials are kept in DEMO_ACCOUNTS.txt. Forgot password remains a disabled native button with blue text, pointer and underline hover, verified without navigation or an action. No attendance verification or deferred product policy was added.
