# 26s1-sc4025-group4

Eatigo Group Dining academic prototype for SC4025. A self-hosted web app for shared dining Events hosted by diners or restaurants.

## Start locally

Start Docker Desktop, then run:

```powershell
docker compose up --build -d
```

Open http://localhost:3000. Demo login: `jacob@gmail.com` / `password123`.

Diners can browse restaurants and available slots, make ordinary bookings, and create or join EatTogether Events. Shared bookings support automatic confirmation, Host Handover, Cutoff, and Last Call. Discovery includes an offline map and local semantic search with personal shortlists.

Restaurant accounts can manage slots and reservations for their assigned venue, host Restaurant and Themed Events, record attendance, and view aggregate Event Feedback.

Verification commands and coverage: [Testing](docs/TESTING.md).

- [Project scope](PROJECT_CONTEXT.md)
- [EatTogether concept alignment and deferred scope](docs/EATTOGETHER_SCOPE.md)
- [Architecture, schema and API](docs/IMPLEMENTATION_PLAN.md)
- [Setup, demo credentials and verification](docs/DEVELOPMENT.md)
- [CI and release deployment](docs/CI_CD.md)
- [Two-user demo walkthrough](docs/DEMO_WALKTHROUGH.md)
- [Discovery architecture and evidence](docs/DISCOVERY.md)
- [Restaurant, photo, map and model sources](docs/SOURCES.md)

Stack: React, TypeScript, Vite, Express, Prisma, PostgreSQL and Docker Compose. No cloud service is required at runtime.
