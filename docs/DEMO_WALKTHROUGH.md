# Demonstration walkthrough

For a timed five-minute presentation, see [PRESENTATION_DEMO.md](PRESENTATION_DEMO.md).

## Setup

Run `docker compose up --build -d` and open http://localhost:3000. Startup creates missing slots for seven days and sample parties for tomorrow. Existing parties and bookings are preserved.

Use two browser profiles, a normal/private window pair, or two devices. Tabs in one profile share a login cookie. Use `jacob@gmail.com` and `chongwei@gmail.com`, both with password `password123`.

## Shared booking

1. Sign in as Jacob and choose an unallocated future time at Seorae or Yan Lai Ju with a four-diner minimum and six-diner capacity. New seed slots at these venues use those synthetic limits; older slots retain their original limits.
2. Choose a Party size of two, select **EatTogether**, then **Start an EatTogether Event** and enter an Event name. The Event starts Undersubscribed and holds the table. Its capacity comes from the slot.
3. Sign in as Chongwei in the second session. Select the same restaurant/time: select the existing Event card or its time button, then **Join Event · 2 diners** in the booking panel. No creation form is shown for an existing Event.
4. The Event automatically becomes Confirmed at four diners. Both accounts see the same booking reference under **account menu → Bookings**. Private reservations appear on the left and shared Events on the right; a shared reservation is shown once, with its reference. No Host confirmation button is needed.
5. Before dining time, Chongwei can shrink her Party to one. At three diners, the Event becomes Undersubscribed and the reservation becomes pending, shown as **Waiting for diners** in the EatTogether list, with no confirmed reservation reference there. Grow back to two to restore the same booking ID. Another eligible Party may still Join after confirmation if there is space.
6. Jacob can **Leave Event → Confirm leave**: Chongwei becomes Host, and shared-booking ownership follows. This leaves Chongwei's Party in the Event. If Chongwei is the last Party and Leaves, the Event is cancelled and its table is released.
7. Alternatively, the Host can explicitly **Cancel Event for everyone** before dining time. Each remaining participant can independently delete the cancelled reservation from their own history.

For an ordinary reservation, use the default **Book** tab and a Party size meeting the slot minimum. Ordinary reservations and Events still compete for one exclusive table allocation. A Party meeting the minimum cannot newly create or Join an Event in this scope.

## Map and recommendations

1. In Restaurants, switch to **Map view**. Select a restaurant photo pin or use the restaurant list to see its available EatTogether Events.
2. Use the cuisine or search filters to narrow venues. **Show all restaurants** restores an overview of the filtered map results.
3. Open **For you** on the restaurant homepage and enter a dining mood. Select **EatTogether** to search parties or **Restaurant** to search venues. Korean barbecue should favour Seorae when its sample party is still eligible; a dessert/study-break mood should favour 2SCOOPS.
4. Swipe right to save or left to skip. Buttons and keyboard arrows offer the same actions. Undo restores the previous decision; saving does not join a party.
5. Open **My shortlist** and review a saved party before joining. Type NTU in the optional location field and test the radius filter; distances are straight-line, not travel distances.

## Scope

Real venue examples and source photos are bundled locally. Discounts, inventory, identities and reservations are demonstration data, not live Eatigo bookings. There are no payments or restaurant-hosted events. Registration and password recovery are non-functional interface mockups. The model and map operate locally after initial setup; client devices still require access to the running host.

The concept's shared seat pool, Cutoff/Last Call, full-price fallback, profile filters, chat and penalties are deferred. See [EATTOGETHER_SCOPE.md](EATTOGETHER_SCOPE.md).
