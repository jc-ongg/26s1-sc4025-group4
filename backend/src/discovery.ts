import { Router } from "express";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { embed, embeddingHash, modelVersion } from "./embeddings.js";
import { groupInclude, HttpError } from "./dining.js";

export const discovery = Router();
// Concurrent searches share one indexing pass; changed content is detected by its hash.
let indexing: Promise<void> | undefined;
async function indexContent() {
  if (indexing) return indexing;
  indexing = (async () => {
    const restaurants = await db.restaurant.findMany({
      where: { active: true },
    });
    const content = (r: (typeof restaurants)[number]) =>
      `${r.name}. ${r.cuisine}. ${r.area}. ${r.description} ${r.tags.join(", ")}. ${r.signatureDishes.join(", ")}`;
    for (const r of restaurants) {
      const text = content(r),
        hash = embeddingHash(text);
      if (r.embeddingHash === hash) continue;
      const vector = JSON.stringify(await embed(text));
      await db.$executeRaw`UPDATE "Restaurant" SET embedding = ${vector}::vector, "embeddingHash" = ${hash} WHERE id = ${r.id}`;
    }
    const groups = await db.groupDiningSession.findMany({
      where: {
        status: "OPEN",
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
const centres: Record<string, [number, number]> = {
  ntu: [1.3483, 103.6831],
  jurong: [1.333, 103.742],
  clementi: [1.315, 103.765],
  city: [1.293, 103.852],
};
function distance(lat: number, lon: number, centre: [number, number]) {
  const rad = Math.PI / 180,
    a =
      Math.sin(((lat - centre[0]) * rad) / 2) ** 2 +
      Math.cos(lat * rad) *
        Math.cos(centre[0] * rad) *
        Math.sin(((lon - centre[1]) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
discovery.post("/discovery/search", async (req, res) => {
  const { mood, mode = "groups", area = "any", radius = 15 } = req.body ?? {};
  if (
    typeof mood !== "string" ||
    !mood.trim() ||
    mood.length > 400 ||
    !["groups", "restaurants"].includes(mode) ||
    (area !== "any" && !centres[area]) ||
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius < 1 ||
    radius > 50
  )
    throw new HttpError(
      400,
      "Describe your meal in 1–400 characters and choose valid filters.",
    );
  let vector: string;
  try {
    await indexContent();
    vector = JSON.stringify(await embed(mood.trim()));
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
  const excluded = new Set(saved.map((d) => d.targetKey));
  const groups =
    mode === "groups"
      ? await db.groupDiningSession.findMany({
          where: {
            status: "OPEN",
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
            slots: { some: { startsAt: { gt: new Date() }, allocation: null } },
          },
          include: {
            slots: {
              where: { startsAt: { gt: new Date() }, allocation: null },
            },
          },
        })
      : [];
  const candidates =
    mode === "groups"
      ? groups
          .filter((g) => g.members.length < g.capacity)
          .map((g) => ({
            id: g.id,
            key: `group:${g.id}`,
            restaurant: g.slot.restaurant,
            group: g,
          }))
      : restaurants.map((r) => ({
          id: r.id,
          key: `restaurant:${r.id}`,
          restaurant: r,
          group: undefined,
        }));
  const eligible = candidates
    .filter((c) => !excluded.has(c.key))
    .map((c) => ({
      ...c,
      distanceKm:
        area !== "any" &&
        c.restaurant.latitude !== null &&
        c.restaurant.longitude !== null
          ? distance(c.restaurant.latitude, c.restaurant.longitude, centres[area])
          : null,
    }))
    .filter((c) => area === "any" || (c.distanceKm !== null && c.distanceKm <= radius));
  if (!eligible.length) {
    res.json({ results: [], model: modelVersion });
    return;
  }
  const ids = Prisma.join(eligible.map((c) => c.id));
  // Only available, geographically eligible, unseen candidates enter vector ranking.
  const ranked =
    mode === "groups"
      ? await db.$queryRaw<
          { id: string; similarity: number }[]
        >`SELECT id, 1 - (embedding <=> ${vector}::vector) AS similarity FROM "GroupDiningSession" WHERE id IN (${ids}) AND embedding IS NOT NULL ORDER BY embedding <=> ${vector}::vector LIMIT 30`
      : await db.$queryRaw<
          { id: string; similarity: number }[]
        >`SELECT id, 1 - (embedding <=> ${vector}::vector) AS similarity FROM "Restaurant" WHERE id IN (${ids}) AND embedding IS NOT NULL ORDER BY embedding <=> ${vector}::vector LIMIT 30`;
  res.json({
    results: ranked.map((row) => ({
      ...eligible.find((c) => c.id === row.id),
      similarity: row.similarity,
    })),
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
      ? await db.groupDiningSession.findUnique({ where: { id } })
      : await db.restaurant.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, "This dining option no longer exists.");
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
discovery.get("/discovery/saved", async (_req, res) => {
  const saved = await db.discoveryDecision.findMany({
    where: { userId: res.locals.userId, decision: "SAVE" },
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
      const restaurant =
        group?.slot.restaurant ??
        (kind === "restaurant"
          ? await db.restaurant.findUnique({ where: { id } })
          : null);
      return restaurant ? { key: d.targetKey, restaurant, group } : null;
    }),
  );
  res.json({ results: results.filter(Boolean) });
});
