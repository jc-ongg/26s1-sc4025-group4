# Demonstration walkthrough

For a timed five-minute presentation, see [PRESENTATION_DEMO.md](PRESENTATION_DEMO.md).

## Setup

Run `docker compose up --build -d` and open http://localhost:3000. Startup creates missing slots for seven days and sample parties for tomorrow. Existing parties and bookings are preserved.

Use two browser profiles, a normal/private window pair, or two devices. Tabs in one profile share a login cookie. Use `jacob@gmail.com` and `chongwei@gmail.com`, both with password `password123`.

## Shared booking

1. Sign in as Jacob and choose an unallocated future time at Joya Onsen Cafe with a two-diner minimum. Two individual accounts are enough to demonstrate confirmation.
2. Select **EatTogether** for your one seat, then **Start an EatTogether Event** and enter an Event name. The Event starts Undersubscribed and holds the table. Its capacity comes from the slot.
3. Sign in as Chongwei in the second session. Select the same restaurant/time: select the existing Event card or its time button, then **Join Event · 1 diner** in the booking panel. No creation form is shown for an existing Event.
4. The Event automatically becomes Confirmed at two diners. Both accounts see the same booking reference under **account menu → Bookings**. Private reservations appear on the left and shared Events on the right; a shared reservation is shown once, with its reference. No Host confirmation button is needed.
5. Before dining time, Chongwei can Leave. At one diner, the Event becomes Undersubscribed and its reservation becomes pending, shown as **Waiting for diners**. Rejoin with the same account to restore the same booking ID. Other accounts may still Join after confirmation if there is space.
6. Jacob can **Leave Event → Confirm leave**: Chongwei becomes Host, and shared-booking ownership follows. This leaves Chongwei's Party in the Event. If Chongwei is the last Party and Leaves, the Event is cancelled and its table is released.
7. Alternatively, the Host can explicitly **Cancel Event for everyone** before dining time. Each remaining participant can independently delete the cancelled reservation from their own history.

For an ordinary reservation, use the default **Book** tab and a Party size meeting the slot minimum. Ordinary reservations and Events still compete for one exclusive table allocation. A Party meeting the minimum cannot newly create or Join an Event in this scope.

## Map and recommendations

1. Use the **Restaurants | EatTogether** toggle on the homepage to switch between venues and upcoming Events. Search and cuisine filters apply to both. Restaurant cards show the number of upcoming EatTogether Events, including full tables; an Event is a shared table, while each participating group of diners is a Party.
2. In Restaurants, switch to **Map view**. Select a restaurant photo pin or use the restaurant list to see its upcoming EatTogether Events.
3. Use the cuisine or search filters to narrow venues. **Show all restaurants** restores an overview of the filtered map results.
4. Open **For you** on the left of the browse controls. It opens a popup with restaurant recommendations only. Enter a dining mood; the homepage cuisine carries into the popup and can be changed there. Choosing Western constrains results to Western restaurants before semantic ranking, even if the mood mentions Chinese food. Location is optional. Close with ×, Escape or a click outside the popup.
5. Swipe right to save or left to skip. Buttons and keyboard arrows offer the same actions. Undo restores the previous decision; saving does not join a party.
6. Open **My shortlist** and select a saved restaurant, then use its Book | EatTogether flow. Type NTU in the optional location field and test the radius filter; distances are straight-line, not travel distances.

## Scope

Real venue examples and source photos are bundled locally. Discounts, inventory, identities and reservations are demonstration data, not live Eatigo bookings. There are no payments or restaurant-hosted events. Registration and password recovery are non-functional interface mockups. The model and map operate locally after initial setup; client devices still require access to the running host.

The concept's shared seat pool, Cutoff/Last Call, full-price fallback, profile filters, chat and penalties are deferred. See [EATTOGETHER_SCOPE.md](EATTOGETHER_SCOPE.md).
