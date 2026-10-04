import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import type { Restaurant } from "./types";
import { Art, Empty, RestaurantEventCount } from "./dining-ui";
type Result = {
  key: string;
  restaurant: Restaurant;
  distanceKm?: number | null;
  similarity?: number;
};
type Undo = { item: Result; previous: string | null };
export function Discover({
  cuisines,
  initialCuisine,
  eventCounts,
}: {
  cuisines: string[];
  initialCuisine: string;
  eventCounts: Map<string, number> | undefined;
}) {
  const [mood, setMood] = useState(""),
    [cuisine, setCuisine] = useState(initialCuisine),
    [area, setArea] = useState(""),
    [radius, setRadius] = useState(15);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  function switchTab(next: string) {
    setTab(next);
  }
  const [results, setResults] = useState<Result[] | null>(null),
    [saved, setSaved] = useState<Result[]>([]),
    [tab, setTab] = useState("discover"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [undo, setUndo] = useState<Undo | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const preferenceVersion = useRef(0);
  useEffect(() => () => searchRequest.current?.abort(), []);
  useEffect(() => {
    updatePreferences(() => setCuisine(initialCuisine));
  }, [initialCuisine]);
  function updatePreferences(change: () => void) {
    preferenceVersion.current += 1;
    if (searchRequest.current) {
      searchRequest.current.abort();
      searchRequest.current = null;
      setBusy(false);
    }
    change();
    setResults(null);
    setUndo(null);
    setNotice("");
    setError("");
  }
  async function search(e?: FormEvent) {
    e?.preventDefault();
    const controller = new AbortController();
    searchRequest.current?.abort();
    searchRequest.current = controller;
    setBusy(true);
    setError("");
    setUndo(null);
    setNotice("");
    setResults(null);
    try {
      const data = await api<{ results: Result[] }>(
        "/discovery/search",
        { mood, mode: "restaurants", cuisine, area: area.trim(), radius },
        { timeoutMs: 120_000, signal: controller.signal },
      );
      if (!controller.signal.aborted) setResults(data.results);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (searchRequest.current === controller) {
        searchRequest.current = null;
        setBusy(false);
      }
    }
  }
  async function loadSaved() {
    switchTab("saved");
    if (savedLoading) return;
    setSavedLoading(true);
    setError("");
    try {
      setSaved(
        (await api<{ results: Result[] }>("/discovery/saved?mode=restaurants")).results,
      );
      setSavedLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavedLoading(false);
    }
  }
  async function decide(decision: "SAVE" | "SKIP") {
    const item = results?.[0];
    if (!item || busy) return;
    const version = preferenceVersion.current;
    setBusy(true);
    setError("");
    try {
      const response = await api<{ previous: string | null }>("/discovery/decision", {
        key: item.key,
        decision,
      });
      // A completed write remains saved, but cannot restore cards from older preferences.
      if (version !== preferenceVersion.current) return;
      setUndo({ item, previous: response.previous });
      setResults((old) => old?.filter((r) => r.key !== item.key) ?? []);
      setNotice(decision === "SAVE" ? "Saved to shortlist." : "Skipped.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function undoLast() {
    if (!undo || busy) return;
    const version = preferenceVersion.current;
    setBusy(true);
    setError("");
    try {
      await api("/discovery/decision", {
        key: undo.item.key,
        decision: undo.previous,
      });
      if (version !== preferenceVersion.current) return;
      setResults((old) => [undo.item, ...(old ?? [])]);
      setUndo(null);
      setNotice("Last swipe undone.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(key: string) {
    setBusy(true);
    setError("");
    try {
      await api("/discovery/decision", { key, decision: null });
      setSaved((old) => old.filter((r) => r.key !== key));
      setResults(null);
      setUndo(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const item = results?.[0],
    r = item?.restaurant;
  return (
    <>
      <div className="mode-tabs discovery-tabs">
        <button
          disabled={busy}
          className={tab === "discover" ? "selected" : ""}
          aria-pressed={tab === "discover"}
          onClick={() => switchTab("discover")}
        >
          Discover
        </button>
        <button
          disabled={busy}
          className={tab === "saved" ? "selected" : ""}
          aria-pressed={tab === "saved"}
          onClick={() => void loadSaved()}
        >
          My shortlist
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="discovery-content">
        {tab === "saved" ? (
          <>
            <div className="shortlist-status" role="status">
              {savedLoading ? "Updating shortlist…" : ""}
            </div>
            {saved.length ? (
              <div className="grid">
                {saved.map((s) => (
                  <article className="card" key={s.key}>
                    <Art restaurant={s.restaurant} />
                    <div className="card-body">
                      <h3>{s.restaurant.name}</h3>
                      <p className="small">
                        {s.restaurant.cuisine} · {s.restaurant.area}
                      </p>
                      <RestaurantEventCount
                        count={eventCounts && (eventCounts.get(s.restaurant.id) ?? 0)}
                      />
                      <div className="row">
                        <a
                          className="button dark"
                          href={`#/restaurants/${s.restaurant.id}`}
                        >
                          View restaurant →
                        </a>
                        <button
                          className="text-button"
                          disabled={busy || savedLoading}
                          onClick={() => void remove(s.key)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title={
                  savedLoading && !savedLoaded ? "Loading shortlist…" : "No saved items"
                }
                text={
                  savedLoading && !savedLoaded ? "" : "Saved restaurants appear here."
                }
              />
            )}
          </>
        ) : (
          <div className="discovery-layout">
            <aside className="panel mood-panel">
              <h2>Preferences</h2>
              <form onSubmit={search}>
                <label htmlFor="mood">Your dining mood</label>
                <textarea
                  id="mood"
                  rows={4}
                  maxLength={400}
                  required
                  disabled={busy}
                  value={mood}
                  onChange={(e) => updatePreferences(() => setMood(e.target.value))}
                  placeholder="Cuisine, dishes or dining atmosphere"
                />
                <label htmlFor="discovery-cuisine">Cuisine</label>
                <select
                  id="discovery-cuisine"
                  value={cuisine}
                  disabled={busy}
                  onChange={(e) => updatePreferences(() => setCuisine(e.target.value))}
                >
                  <option value="">All cuisines</option>
                  {cuisines.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <label htmlFor="discovery-area">
                  Location <span className="muted">(optional)</span>
                </label>
                <input
                  id="discovery-area"
                  value={area}
                  disabled={busy}
                  maxLength={120}
                  onChange={(e) => updatePreferences(() => setArea(e.target.value))}
                  placeholder="Neighbourhood or restaurant name"
                />
                {area.trim() && (
                  <>
                    <label htmlFor="radius">Within {radius} km</label>
                    <input
                      id="radius"
                      type="range"
                      min="1"
                      max="30"
                      value={radius}
                      disabled={busy}
                      onChange={(e) =>
                        updatePreferences(() => setRadius(Number(e.target.value)))
                      }
                    />
                  </>
                )}
                <button disabled={busy || !mood.trim()}>
                  {busy ? "Searching…" : "Find matches"}
                </button>
              </form>
            </aside>
            <section className="swipe-column" aria-label="Dining recommendations">
              {busy && !item ? (
                <div className="empty" role="status">
                  <h3>Finding matches…</h3>
                </div>
              ) : item && r ? (
                <>
                  <div className="row small muted">
                    <span>
                      {results?.length} {results?.length === 1 ? "match" : "matches"}
                    </span>
                  </div>
                  <article
                    className="card swipe-card"
                    tabIndex={0}
                    aria-label="Recommendation card. Left arrow to skip, right arrow to save."
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        void decide("SKIP");
                      }
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        void decide("SAVE");
                      }
                    }}
                    onPointerDown={(e) => {
                      if (
                        !e.isPrimary ||
                        e.button !== 0 ||
                        (e.target as Element).closest("a, button")
                      )
                        return;
                      pointer.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerCancel={() => {
                      pointer.current = null;
                    }}
                    onPointerUp={(e) => {
                      const p = pointer.current;
                      pointer.current = null;
                      if (!p) return;
                      const dx = e.clientX - p.x,
                        dy = e.clientY - p.y;
                      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5)
                        void decide(dx > 0 ? "SAVE" : "SKIP");
                    }}
                  >
                    <Art restaurant={r} />
                    <div className="card-body">
                      <p className="eyebrow">
                        {r.cuisine} · {r.area}
                        {item.distanceKm != null
                          ? ` · ${item.distanceKm.toFixed(1)} km away`
                          : ""}
                      </p>
                      <h2>{r.name}</h2>
                      <p>{r.description}</p>
                      <div className="chips">
                        {r.tags.map((tag) => (
                          <span className="badge" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <RestaurantEventCount
                        count={eventCounts && (eventCounts.get(r.id) ?? 0)}
                      />
                      <a className="text-button" href={`#/restaurants/${r.id}`}>
                        View restaurant →
                      </a>
                    </div>
                  </article>
                  <div className="swipe-actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void decide("SKIP")}
                    >
                      ← Skip
                    </button>
                    <button
                      className="dark"
                      disabled={busy}
                      onClick={() => void decide("SAVE")}
                    >
                      ♡ Save →
                    </button>
                  </div>
                </>
              ) : results ? (
                <Empty
                  title="No more matches"
                  text="Try another search, change the cuisine or widen the location radius."
                />
              ) : (
                <div className="empty discovery-welcome">
                  <h2>Your matches</h2>
                  <p>
                    {mood.trim()
                      ? "Select Find matches to search."
                      : "Enter your dining preferences to search."}
                  </p>
                </div>
              )}
              {notice && (
                <p className="note small" role="status">
                  {notice}
                </p>
              )}
              {undo && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void undoLast()}
                >
                  ↶ Undo last swipe
                </button>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
