# Five-minute Product Engineer presentation

Allocate about four minutes to the live app, with 20 seconds to frame the problem and 40 seconds for the technical explanation. Rehearse with a timer; the times below are targets, not measured presentation times. The existing report and diagrams are unchanged.

## Before presenting

- Start Docker Desktop and run `docker compose up --build -d` well before the session. Open http://localhost:3000.
- Use a normal browser window as Jacob and a private window or separate profile as Alice. Ordinary tabs share the login cookie. Both use `demo123`; log in before presenting.
- Select an unallocated future Seorae or Yan Lai Ju slot with a minimum of four and capacity of six. Check the displayed minimum: older slots may retain two-diner limits. These are synthetic demo offers.
- In the map overview, use the restaurant selector to choose a venue; nearby photo pins can overlap until you zoom in. The selector also zooms to the chosen restaurant.
- Keep Jacob on the restaurant page and Alice on the same restaurant/date. Only switch windows when the story needs the other Party.
- Rehearse and warm the semantic search once. Use Restaurant mode, leave location blank and type `Korean grilled meat and sharing plates`. Confirm that the expected venue is eligible; previous Save/Skip decisions affect results. Avoid saving/skipping that venue during rehearsal. Search results are semantic rankings, not a guaranteed fixed order.
- Keep text fields empty before the live demo. Prepare the Event name `BBQ dinner at Seorae`; type it during creation. An optional note is unnecessary.
- Rehearsal Events can be cancelled normally and their cancelled reservation removed from personal history. Do not reset the database: existing records should remain.
- Prepare a short screen recording as a fallback if the presentation machine or network cannot reach the host. A second physical device is optional; two independent browser sessions are sufficient.

## Opening: 0:00–0:20

Say: “Eatigo's normal flow lets diners book a discounted table. Our EatTogether addition lets a Party below the restaurant's minimum combine with other Parties. I’ll demonstrate two accounts sharing the same live Event.”

## Live demo: 0:20–4:20

| Demo time | Action                                                                                                                                                    | Point to explain                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Jacob: Restaurants → Map view, choose Seorae in the restaurant selector, then open its restaurant page.                                                   | Discovery stays centred on restaurants. EatTogether is an optional addition to booking.                                                        |
| 0:25–1:00 | Jacob: EatTogether → For you. Search Restaurant mode with the rehearsed Korean dining mood and open the relevant restaurant card.                         | Local semantic retrieval ranks venue descriptions by meaning. Saving and joining are separate actions; no need to swipe through several cards. |
| 1:00–1:40 | Select the prepared four-diner-minimum slot. Show default Book briefly, switch to EatTogether, choose your Party of two, enter the Event name and create. | Two diners are below the minimum. The Event holds one table while waiting for more diners.                                                     |
| 1:40–2:15 | Switch to Alice. Select the same date/time → View Event. Join as a Party of two. Return to Jacob's Event page.                                            | Two Parties total four diners. Confirmation is automatic and the other account updates through polling. Allow up to five seconds.              |
| 2:15–2:40 | Open My bookings. Point out Reservations on the left and EatTogether on the right, plus Your Party versus Event total.                                    | Each account sees its own Party size and the shared table's count. Both refer to one reservation.                                              |
| 2:40–3:20 | Alice: return to the Event, shrink to one, then restore to two. Watch the pending/confirmed notice and reservation reference.                             | Falling below the minimum suspends confirmation; restoring it reuses the same booking reference.                                               |
| 3:20–4:00 | Jacob: Leave Event. Alice becomes Host. Show Alice's Handover notice, then Jacob rejoins as a Party of two.                                               | The Event continues under the earliest remaining Party. Rejoining restores four diners and confirmation. End on the confirmed Event.           |

If running behind, skip Host Handover in the live demonstration and describe it in one sentence. Keep the creation → joining → automatic confirmation sequence and the Party/total breakdown. Map and semantic discovery are brief supporting features; do not spend the whole demo browsing.

## Technical close: 4:20–5:00

Say: “The frontend is React and TypeScript, backed by Express, Prisma and PostgreSQL. Docker Compose hosts the app, database, map assets and embedding model locally. Joining and booking each run in a database transaction and acquire the same slot lock, so concurrent requests cannot overfill the table or double-book it. Each Event keeps one booking identity even when confirmation changes. Tests cover concurrent joins, Party sizes, confirmation reversion and Host Handover.”

Explain the boundary if asked: one table is exclusively held per slot in this MVP. Shared seat pools, Cutoff/Last Call, full-price fallback, chat, demographic filters and penalties are deferred. The app has demonstration inventory and does not create live Eatigo reservations.

## Backup demonstrations for questions

- Show another Party Joining an already Confirmed Event when there are seats left.
- Show the final Party Leaving, cancellation and table release.
- Show saved recommendations and Undo, without implying that Save reserves a seat.
- Show cancelled reservation deletion as a personal history action.

Do not try to fit these extra flows into the main four minutes.
