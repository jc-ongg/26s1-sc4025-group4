# Group-first semantic discovery

The feature supports the core product hypothesis: a diner who cannot meet a minimum party size can discover a suitable open group. “For you” defaults to groups; restaurant mode helps diners choose where to create their own table. Saving expresses interest; joining remains a separate explicit action and still uses the existing transactional inventory rules.

## Implemented flow

1. Enter a dining mood, choose groups/restaurants and optionally a named area and radius.
2. The server indexes changed venue and open-group descriptions with a local quantized MiniLM model. Content hashes avoid re-embedding unchanged records. New groups are indexed on the next search.
3. Eligibility excludes past, full, confirmed and inactive-venue groups, groups already joined, and the account’s saved/skipped cards. Restaurant mode requires an unallocated future slot. A radius uses straight-line distance from the selected area centre.
4. PostgreSQL `vector(384)` ranks eligible candidates using cosine distance (`<=>`). This is actual dense-vector retrieval, not keyword matching or a fixed list.
5. Swipe right/save, left/skip, or use buttons/keyboard arrows. Undo restores the previous decision. Shortlists persist in PostgreSQL per account.
6. Open a saved group to review current availability and join. The host confirms after the minimum party size is met.

```mermaid
flowchart LR
  A[React mood and area form] --> B[Authenticated Express API]
  B --> C[Local MiniLM ONNX model]
  C --> D[384-dimensional query embedding]
  B --> E[Availability and distance filters]
  E --> F[PostgreSQL + pgvector]
  D --> F
  F --> G[Ranked group cards]
  G --> H[Save or skip per account]
  H --> I[Review group and explicitly join]
```

Raw moods are processed in memory and are not persisted or sent to an external model provider. Stored vectors represent venue/group descriptions, not user identities. Ranking is descriptive similarity, not learned compatibility, a probability of enjoyment, or a dietary-safety guarantee. The interface deliberately avoids match percentages. Search failure reports an error instead of silently substituting keyword search.

## Offline operation and setup

`docker compose up --build -d` downloads packages and the pinned model during the initial build. Afterwards the model, photos, map, API and database run locally. Client devices still need LAN access to the running host; “offline” does not mean an installed app that works without its server. Source attribution links open external websites only when clicked.

The basemap contains 30,654 geographic features (~6.9 MB uncompressed). It supports zoom/pan, restaurant pins and a restaurant selector; selected venue details show available Eatogether parties. The same cuisine/search/Eatogether-party availability filters apply to grid and map. There is no live routing or device-location permission. The map covers western/central Singapore, not the whole country at street-navigation detail.

Existing fictional venue records are archived, not renamed or deleted, preserving earlier booking history. Eight real examples receive synthetic seven-day inventory. Seeded group IDs are stable per date and are not recreated after cancellation or confirmation. Existing user groups and bookings are preserved.

## Verification, 25 September 2026

- Both TypeScript builds and Docker builds passed.
- Local semantic integration test passed: Korean grilled-meat request → Seorae; frozen treats/waffles → 2SCOOPS; calm Japanese lunch → Joya; Italian pasta/pizza in restaurant mode → il Cielo.
- The same test verifies open-seat eligibility, NTU radius filtering, authentication, invalid filters, account-isolated saves, exclusion of decided cards, skip, and undo.
- Six PostgreSQL-backed booking/concurrency regression tests passed, plus two credential unit tests.
- A separate model invocation with Docker `--network none` returned 384 dimensions successfully.
- Browser checks: real photos, grid/map toggle, group filter, semantic results, shortlist save and undo. Phone-sized layout checked for overflow. A pointer swipe right saved a dessert group; keyboard left skipped it; undo restored both test decisions. Restaurant selection zoomed the map and showed the corresponding group.

These are engineering smoke tests on a small curated catalog, not evidence of product-market fit or broad recommendation accuracy. The report should separately present participant usability testing, task completion and time-to-find-a-group. A held-out query benchmark against a lexical baseline is a useful next evaluation; do not claim it has already been conducted.

```powershell
docker compose exec -T backend npm run test:discovery
docker compose exec -T backend npm run test:integration
docker compose exec -T backend npm test
```

## Practical limits

Small English-language model, small static catalog, no collaborative learning or reranking from likes, no live Eatigo availability. Saved groups can fill or expire; joining revalidates availability. A skip persists across searches; the last swipe can be undone during the current page session. Initial inference may take longer while the model loads. Indexing is serialized and exact vector search is appropriate for this demo’s scale; a large catalog would need background indexing, bounded work queues and retrieval evaluation.

Dependency audit still reports five high findings through the Prisma configuration/deepmerge tooling and Transformers.js/sharp dependency chains. This prototype performs text inference only and accepts no image uploads, but the findings remain unresolved and should be addressed before any public deployment. Demo authentication uses seeded credentials.
