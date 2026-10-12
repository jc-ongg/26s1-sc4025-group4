import { Router } from "express";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { embed, embeddingHash, modelVersion } from "./embeddings.js";
import { groupInclude, HttpError, presentGroup, presentRestaurants } from "./dining.js";
import { centres, distance } from "./geography.js";
import { dinerCount } from "./event-lifecycle.js";
import { canViewEvent, matchesEvent } from "./event-eligibility.js";
import {
  diningIntent,
  menuMatch,
  relevantResults,
  venueSearchText,
} from "./discovery-ranking.js";

export const discovery = Router();
// Concurrent searches share one indexing pass; changed content is detected by its hash.
let indexing: Promise<void> | undefined;
async function indexContent() {
  if (indexing) return indexing;
  indexing = (async () => {
    const restaurants = await db.restaurant.findMany({
      where: { active: true },
    });
    const content = venueSearchText;
    for (const r of restaurants) {
      const text = content(r),
        hash = embeddingHash(text);
      if (r.embeddingHash === hash) continue;
      const vector = JSON.stringify(await embed(text));
      await db.$executeRaw`UPDATE "Restaurant" SET embedding = ${vector}::vector, "embeddingHash" = ${hash} WHERE id = ${r.id}`;
    }
    const groups = await db.groupDiningSession.findMany({
      where: {
        status: { in: ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"] },
        slot: { startsAt: { gt: new Date() }, restaurant: { active: true } },
      },
      include: { slot: { include: { restaurant: true } } },
    });
    for (const g of groups) {
      const text = `${g.title}. ${g.description}. ${content(g.slot.restaurant)}`,
        hash = embeddingHash(text);
      if (g.embeddingHash === hash) continue;
      const vector = JSON.stringify(await embed(text));
      await db.$executeRaw`UPDATE "GroupDiningSession" SET embedding = ${vector}::vector, "embeddingHash" = ${hash} WHERE id = ${g.id}`;
    }
  })().finally(() => {
    indexing = undefined;
  });
  return indexing;
}
discovery.post("/discovery/search", async (req, res) => {
  const {
    mood,
    mode = "restaurants",
    area = "any",
    radius = 15,
    cuisine = "",
  } = req.body ?? {};
  if (
    typeof mood !== "string" ||
    !mood.trim() ||
    mood.length > 400 ||
    !["groups", "restaurants"].includes(mode) ||
    typeof area !== "string" ||
    area.length > 120 ||
    typeof cuisine !== "string" ||
    cuisine.length > 80 ||
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius < 1 ||
    radius > 50
  )
    throw new HttpError(
      400,
      "Describe your meal in 1–400 characters and choose valid filters.",
    );
  const location = area.trim().toLowerCase().replace(/\s+/g, " ");
  const intent = diningIntent(mood, cuisine);
  if (!intent.query)
    throw new HttpError(400, "Describe a cuisine, dish or dining atmosphere.");
  let centre: [number, number] | undefined;
  if (location && location !== "any") {
    centre = Object.hasOwn(centres, location) ? centres[location] : undefined;
    if (!centre) {
      // Restaurant records provide local location lookup without an external geocoder.
      const venue = await db.restaurant.findFirst({
        where: {
          active: true,
          OR: [
            { name: { equals: location, mode: "insensitive" } },
            { area: { equals: location, mode: "insensitive" } },
          ],
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { id: "asc" },
      });
      if (venue) centre = [venue.latitude!, venue.longitude!];
    }
    if (!centre)
      throw new HttpError(
        400,
        "Location not found. Enter a Singapore neighbourhood or a listed restaurant name.",
      );
  }
  let vector: string;
  try {
    await indexContent();
    vector = JSON.stringify(await embed(intent.query));
  } catch (error) {
    console.error("Local embedding unavailable", error);
    throw new HttpError(
      503,
      "The local recommendation model is unavailable. Please retry after setup finishes.",
    );
  }
  const saved = await db.discoveryDecision.findMany({
    where: { userId: res.locals.userId },
  });
  const shortlisted = new Set(
    saved.filter((d) => d.decision === "SAVE").map((d) => d.targetKey),
  );
  const groups =
    mode === "groups"
      ? await db.groupDiningSession.findMany({
          where: {
            status: { in: ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"] },
            members: { none: { userId: res.locals.userId } },
            slot: {
              startsAt: { gt: new Date() },
              restaurant: { active: true },
            },
          },
          include: groupInclude,
        })
      : [];
  const restaurants =
    mode === "restaurants"
      ? await db.restaurant.findMany({
          where: {
            active: true,
            slots: { some: { startsAt: { gt: new Date() } } },
          },
          include: {
            slots: {
              where: { startsAt: { gt: new Date() } },
              include: { allocations: true },
            },
          },
        })
      : [];
  const candidates =
    mode === "groups"
      ? groups
          .filter(
            (g) =>
              matchesEvent(res.locals.diner, g) &&
              dinerCount(g.members) < presentGroup(g).capacity,
          )
          .map((g) => ({
            id: g.id,
            key: `group:${g.id}`,
            restaurant: g.slot.restaurant,
            group: presentGroup(g),
          }))
      : (await presentRestaurants(restaurants, res.locals.diner))
          .filter((r) => r.slots.some((s) => s.availableSeats >= s.minimumPartySize))
          .map((r) => ({
            id: r.id,
            key: `restaurant:${r.id}`,
            restaurant: r,
            group: undefined,
          }));
  const eligible = candidates
    .map((c) => ({ ...c, match: menuMatch(c.restaurant, intent) }))
    .filter((c) => c.match !== null)
    .map((c) => ({
      ...c,
      distanceKm:
        centre && c.restaurant.latitude !== null && c.restaurant.longitude !== null
          ? distance(c.restaurant.latitude, c.restaurant.longitude, centre)
          : null,
    }))
    .filter((c) => !centre || (c.distanceKm !== null && c.distanceKm <= radius));
  if (!eligible.length) {
    res.json({ results: [], model: modelVersion });
    return;
  }
  const ids = Prisma.join(eligible.map((c) => c.id));
  // Search is repeatable: a previous swipe must not hide the only matching venue.
  // Skips dismiss the current deck; saved venues return with their shortlist state.
  const ranked =
    mode === "groups"
      ? await db.$queryRaw<
          { id: string; similarity: number }[]
        >`SELECT id, 1 - (embedding <=> ${vector}::vector) AS similarity FROM "GroupDiningSession" WHERE id IN (${ids}) AND embedding IS NOT NULL ORDER BY embedding <=> ${vector}::vector LIMIT 30`
      : await db.$queryRaw<
          { id: string; similarity: number }[]
        >`SELECT id, 1 - (embedding <=> ${vector}::vector) AS similarity FROM "Restaurant" WHERE id IN (${ids}) AND embedding IS NOT NULL ORDER BY embedding <=> ${vector}::vector LIMIT 30`;
  res.json({
    results: relevantResults(
      ranked.map((row) => {
        const candidate = eligible.find((c) => c.id === row.id)!;
        const { match, ...result } = candidate;
        return {
          ...result,
          similarity: row.similarity,
          exact: match!.exact,
          matchReason: match!.reason,
          shortlisted: shortlisted.has(result.key),
        };
      }),
    ).map(({ exact: _exact, ...result }) => result),
    model: modelVersion,
  });
});
discovery.post("/discovery/decision", async (req, res) => {
  const { key, decision } = req.body ?? {};
  if (
    typeof key !== "string" ||
    key.length > 180 ||
    !/^(group|restaurant):[^:]+$/.test(key) ||
    ![null, "SAVE", "SKIP"].includes(decision)
  )
    throw new HttpError(400, "Invalid shortlist action.");
  const [kind, id] = key.split(":");
  const exists =
    kind === "group"
      ? await db.groupDiningSession.findUnique({ where: { id }, include: groupInclude })
      : await db.restaurant.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, "This dining option no longer exists.");
  if (kind === "group" && "members" in exists && !canViewEvent(res.locals.diner, exists))
    throw new HttpError(404, "This dining option no longer exists.");
  const where = {
    userId_targetKey: { userId: res.locals.userId as string, targetKey: key },
  };
  const previous = await db.discoveryDecision.findUnique({ where });
  if (decision === null)
    await db.discoveryDecision.deleteMany({ where: where.userId_targetKey });
  else
    await db.discoveryDecision.upsert({
      where,
      create: { ...where.userId_targetKey, decision },
      update: { decision },
    });
  res.json({ previous: previous?.decision ?? null });
});
discovery.get("/discovery/saved", async (req, res) => {
  const mode = req.query.mode;
  if (mode !== undefined && mode !== "restaurants" && mode !== "groups")
    throw new HttpError(400, "Invalid shortlist filter.");
  const saved = await db.discoveryDecision.findMany({
    where: {
      userId: res.locals.userId,
      decision: "SAVE",
      ...(mode && {
        targetKey: { startsWith: mode === "restaurants" ? "restaurant:" : "group:" },
      }),
    },
    orderBy: { updatedAt: "desc" },
  });
  const results = await Promise.all(
    saved.map(async (d) => {
      const [kind, id] = d.targetKey.split(":");
      const group =
        kind === "group"
          ? await db.groupDiningSession.findUnique({
              where: { id },
              include: groupInclude,
            })
          : null;
      if (group && !canViewEvent(res.locals.diner, group)) return null;
      const restaurant =
        group?.slot.restaurant ??
        (kind === "restaurant"
          ? await db.restaurant.findUnique({ where: { id } })
          : null);
      return restaurant
        ? { key: d.targetKey, restaurant, group: group ? presentGroup(group) : null }
        : null;
    }),
  );
  res.json({ results: results.filter(Boolean) });
});
