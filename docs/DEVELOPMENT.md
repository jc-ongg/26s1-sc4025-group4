# Local demo startup

## Requirements

Docker Desktop running with Linux containers. The first build downloads dependencies and images; the application has no external runtime service dependency.

From the repository root:

```powershell
docker compose up --build -d
docker compose ps
```

Open http://localhost:3000. On another device on the same Wi-Fi, open http://HOST-LAN-IP:3000, using the Windows host's IPv4 address from `ipconfig`. If Windows prompts, permit Docker access on the private network. Guest Wi-Fi client isolation can prevent devices reaching each other. Only port 3000 is published; PostgreSQL and the backend remain internal.

## Accounts

| Email              | Password    |
| ------------------ | ----------- |
| jacob@gmail.com    | password123 |
| chongwei@gmail.com | password123 |
| yojin@gmail.com    | password123 |
| wallace@gmail.com  | password123 |
| harsh@gmail.com    | password123 |
| hansen@gmail.com   | password123 |

Use separate browser profiles/private sessions or devices for different users. Tabs in the same browser profile share the login cookie. Accounts are seeded in PostgreSQL; basic password matching happens on the server. Passwords are deliberately public plain-text demo fixtures. There are no roles or external identity providers. Registration and password reset are non-functional interface mockups; their submit controls are disabled. Sessions persist for 24 hours and are revoked on logout. HTTP-only cookies support local HTTP LAN access.

## Checks and maintenance

Node 22.12+ is required for host-side tooling. Container builds use Node 22.

```powershell
npm ci
npm run generate --workspace backend
npm run typecheck
npm test
npm run build
npm run test:integration
docker compose config --quiet
docker compose logs backend
docker compose down
```

`docker compose down` preserves database data. Startup applies migrations and inserts missing demo accounts without overwriting existing data.

`npm test` runs both credential tests and frontend request/availability tests. `npm run test:web` runs only the frontend suite. Integration checks require the running stack. If Windows restricts the local test runner, credential tests can also run with `docker compose exec -T backend npm test`; this does not run the host-side frontend suite.

For frontend development, `npm run dev --workspace frontend` starts port 3000 and proxies /api to localhost:4000. Run the backend against a reachable PostgreSQL database with DATABASE_URL configured. The default Compose database intentionally has no host port.

## Release deployment

GitHub Actions validates changes and prepares a source release for manual deployment on this laptop. See [CI_CD.md](CI_CD.md) for the pipeline and artifact instructions. Normal `docker compose up --build -d` remains available for development. The default port is unchanged; `EATIGO_PORT` and `EATIGO_BIND_ADDRESS` allow isolated testing. `/version.json` returns the release commit, or `development` for a normal local build.

## Manual foundation checks

1. Log in as Jacob with the documented password; refresh and verify identity persists.
2. Log out; refresh and verify the login form returns.
3. Submit a wrong password and verify a readable error without authentication.
4. Log in as Chongwei in a separate browser/device and verify the two identities remain independent.
5. Verify health responds at /api/health and no response exposes demoPassword or a session token in JSON.

## Verification and known limitations

See [TESTING.md](TESTING.md) for test coverage and [DISCOVERY.md](DISCOVERY.md) for the semantic model, offline assets and dependency-audit limitations.

Restaurant accounts use the Restaurant login tab and are scoped to one venue. Credentials are listed in [DEMO_ACCOUNTS.txt](DEMO_ACCOUNTS.txt). Singpass/Corppass completion screens remain paused; the fixtures are already verified.

For a rehearsal, run `npm run demo:prepare` against the running Compose stack. It replaces only the named practice scenarios and resets their practice accounts; it does not reset the six team accounts or unrelated bookings. See [TABLE_5_WALKTHROUGH.md](TABLE_5_WALKTHROUGH.md) for the sequence and [CHAPTER_5_ENGINEERING_EVIDENCE.md](CHAPTER_5_ENGINEERING_EVIDENCE.md) for report evidence. Prepare immediately before rehearsing because Cutoff follows the real clock.

## Code style

`npm run format` formats TypeScript, JavaScript, CSS, JSON, YAML and Markdown. `npm run format:check` verifies formatting without changing files. Generated assets, the lockfile, model files and temporary files are excluded. Editor defaults are in `.editorconfig`; Prisma schema formatting uses `npx prisma format --schema backend/prisma/schema.prisma`. Python import scripts use Black with a 90-character line length.

Frontend styling is split into `styles/base.css`, `styles/features.css` and `styles/theme.css`, imported in that order. Booking history has its own `Bookings.tsx` component. Comments focus on shared inventory locks, asynchronous state, model reuse and per-account history semantics.
