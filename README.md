# 26s1-sc4025-group4

Eatigo Group Dining academic prototype for SC4025. A self-hosted responsive web app demonstrating diner-created shared tables.

## Start locally

Start Docker Desktop, then run:

```powershell
docker compose up --build -d
```

Open http://localhost:3000. Demo login: `jacob@gmail.com` / `password123`.

Implemented: account login, restaurant browsing and slots, diner-created groups, Party-size join/leave/resize, automatic confirmation and Host Handover, cancellation, ordinary bookings, and personal booking views. Also implemented: eight real restaurant examples, an offline map with group availability, and local semantic discovery with swipe/save/skip/undo and per-account shortlists. Restaurant-hosted events remain deferred.

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
