# Demonstration walkthrough

For a timed five-minute presentation, see [PRESENTATION_DEMO.md](PRESENTATION_DEMO.md). For restaurant account tasks, see [TABLE_5_WALKTHROUGH.md](TABLE_5_WALKTHROUGH.md).

## Setup

Run `docker compose up --build -d` and open http://localhost:3000. Startup creates missing slots for seven days and sample parties for tomorrow. Existing parties and bookings are preserved.

Use two browser profiles, a normal/private window pair, or two devices. Tabs in one profile share a login cookie. Use `jacob@gmail.com` and `chongwei@gmail.com`, both with password `password123`.

## Shared booking

1. Sign in as Jacob and choose a Joya Onsen Cafe time more than two hours away, with a two-diner minimum, enough free seats, and no eligible Event to join at that time.
2. Select **EatTogether** for your one seat, then **Start an EatTogether Event**. Enter a name and select **Create Event**. The Event starts as **Waiting for diners** and holds the minimum seats.
3. Sign in as Chongwei in the second session. Select the same restaurant/time: select the existing Event card or its time button, then **Join Event · 1 diner** in the booking panel. No creation form is shown for an existing Event.
4. The Event automatically becomes Confirmed at two diners. Both accounts see the same booking reference under **account menu → Bookings**. Private reservations appear on the left and shared Events on the right; a shared reservation is shown once, with its reference. No Host confirmation button is needed.
5. Before Cutoff, Chongwei can leave. At one diner, the Event returns to **Waiting for diners** and the reservation becomes pending. Rejoin with the same account to restore the same booking ID.
6. Jacob can **Leave Event → Confirm leave**: Chongwei becomes Host, and shared-booking ownership follows. This leaves Chongwei's Party in the Event. If Chongwei is the last Party and Leaves, the Event is cancelled and its table is released.

For an ordinary reservation, use the default **Book** tab and a Party size that meets the slot minimum. Ordinary reservations and EatTogether Events draw from the same seat pool.

## Map and recommendations

1. In **Restaurant view**, expand a venue's EatTogether section to see upcoming Events. The **EatTogether** filter can limit the list to venues **With Events** or **With seats available**.
2. Switch to **Map view**. Select a restaurant photo pin or use the restaurant selector to see its upcoming EatTogether Events.
3. Use the cuisine or search filters to narrow venues. **Show all restaurants** restores an overview of the filtered map results.
4. Open **For you** to the right of the search bar and enter a dining mood, such as `Japanese rice bowls and a quiet lunch`. Add an optional location such as `NTU` to search within 15 km in a straight line. Close the popup with ×, Escape, or a click outside.
5. Swipe right to save or left to skip. Buttons and keyboard arrows offer the same actions. Undo restores the previous decision; saving does not join a party.
6. Open **My shortlist** and select a saved restaurant, then choose **Book** or **EatTogether** on its booking page.

## Scope

Real venue examples and source photos are bundled locally. Discounts, inventory, identities, and reservations are demonstration data. The model and map run on the local host after initial setup. See [EatTogether implementation scope](EATTOGETHER_SCOPE.md) for booking rules and prototype limits.
