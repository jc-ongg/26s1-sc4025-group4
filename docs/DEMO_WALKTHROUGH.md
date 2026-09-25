# Demonstration walkthrough

## Setup

Run `docker compose up --build -d` and open http://localhost:3000. Startup creates missing slots for seven days and sample parties for tomorrow. Existing parties and bookings are preserved.

Use two browser profiles, a normal/private window pair, or two devices. Tabs in one profile share a login cookie. Use `jacob@example.com` and `alice@example.com`, both with password `demo123`.

## Shared booking

1. Sign in as Jacob, choose a restaurant and an available future time.
2. Select **Eatogether**, choose four seats and enter a title. Jacob occupies the first seat; confirmation requires the slot's minimum party size.
3. Sign in as Alice in the second session. Find the party under **Eatogether** and join.
4. Jacob's page updates within five seconds. Confirm once the minimum is reached, even if some seats remain empty.
5. Open **My bookings** in both sessions. Both diners see the same booking reference. Joining and leaving are closed after confirmation.
6. Before the reservation starts, Jacob can cancel it. The slot is released. Each diner can independently delete the cancelled booking from their own history without affecting the other person's record.

For an ordinary reservation, use the default **Book** tab on the restaurant page. Ordinary reservations and Eatogether parties compete for the same slot.

## Map and recommendations

1. In Restaurants, switch to **Map view**. Select a restaurant photo pin or use the restaurant list to see its available Eatogether parties.
2. Use the cuisine or search filters to narrow venues. **Show all restaurants** restores an overview of the filtered map results.
3. Open **Eatogether → For you** and enter a dining mood. Select **Eatogether** to search parties or **Restaurant** to search venues. Korean barbecue should favour Seorae when its sample party is still eligible; a dessert/study-break mood should favour 2SCOOPS.
4. Swipe right to save or left to skip. Buttons and keyboard arrows offer the same actions. Undo restores the previous decision; saving does not join a party.
5. Open **My shortlist** and review a saved party before joining. Type NTU in the optional location field and test the radius filter; distances are straight-line, not travel distances.

## Scope

Real venue examples and source photos are bundled locally. Discounts, inventory, identities and reservations are demonstration data, not live Eatigo bookings. There are no payments, restaurant-hosted events, registration or password reset. The model and map operate locally after initial setup; client devices still require access to the running host.
