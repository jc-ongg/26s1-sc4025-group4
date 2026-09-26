import { useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import type { Group, Restaurant } from "./types";
import { Art, Empty, Status, date, time } from "./dining-ui";
type Result = {
  key: string;
  restaurant: Restaurant;
  group?: Group | null;
  distanceKm?: number | null;
  similarity?: number;
};
type Undo = { item: Result; previous: string | null };
export function Discover() {
  const [mood, setMood] = useState(""),
    [mode, setMode] = useState("restaurants"),
    [area, setArea] = useState(""),
    [radius, setRadius] = useState(15);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const content = useRef<HTMLDivElement>(null);

  function switchTab(next: string) {
    // Preserve the workspace height so shorter tabs do not move the page beneath the pointer.
    setContentHeight(content.current?.getBoundingClientRect().height ?? 0);
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
  async function search(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setUndo(null);
    setNotice("");
    setResults(null);
    try {
      const data = await api<{ results: Result[] }>("/discovery/search", {
        mood,
        mode,
        area: area.trim(),
        radius,
      });
      setResults(data.results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadSaved() {
    switchTab("saved");
    if (savedLoading) return;
    setSavedLoading(true);
    setError("");
    try {
      setSaved((await api<{ results: Result[] }>("/discovery/saved")).results);
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
    setBusy(true);
    setError("");
    try {
      const response = await api<{ previous: string | null }>("/discovery/decision", {
        key: item.key,
        decision,
      });
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
    setBusy(true);
    setError("");
    try {
      await api("/discovery/decision", {
        key: undo.item.key,
        decision: undo.previous,
      });
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
    g = item?.group,
    r = item?.restaurant;
  return (
    <>
      <div className="page-intro">
        <h1>For you</h1>
      </div>
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
      <div
        ref={content}
        className="discovery-content"
        style={{ minHeight: contentHeight }}
      >
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
                      {s.group && (
                        <Status
                          value={
                            s.group.slot.startsAt <= new Date().toISOString() &&
                            ["OPEN", "FULL"].includes(s.group.status)
                              ? "EXPIRED"
                              : s.group.status
                          }
                        />
                      )}
                      <h3>{s.group?.title ?? s.restaurant.name}</h3>
                      <p>{s.group ? s.restaurant.name : s.restaurant.area}</p>
                      {s.group && (
                        <p className="small">
                          {date(s.group.slot.startsAt)} · {time(s.group.slot.startsAt)} ·{" "}
                          {s.group.members.length}/{s.group.capacity} joined
                        </p>
                      )}
                      <div className="row">
                        <a
                          className="button dark"
                          href={`#/${s.group ? "groups/" + s.group.id : "restaurants/" + s.restaurant.id}`}
                        >
                          {s.group ? "View party" : "View restaurant"} →
                        </a>
                        <button
                          className="text-button"
                          disabled={busy}
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
                  savedLoading && !savedLoaded
                    ? ""
                    : "Saved restaurants and parties appear here."
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
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="Something spicy, shared dishes and a lively group"
                />
                <div className="mode-tabs" role="group" aria-label="Help me find">
                  {[
                    ["restaurants", "Restaurant"],
                    ["groups", "Eatogether"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={mode === value ? "selected" : ""}
                      aria-pressed={mode === value}
                      onClick={() => setMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label htmlFor="discovery-area">
                  Location <span className="muted">(optional)</span>
                </label>
                <input
                  id="discovery-area"
                  value={area}
                  maxLength={120}
                  onChange={(e) => setArea(e.target.value)}
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
                      onChange={(e) => setRadius(Number(e.target.value))}
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
                    <span>{results?.length} matches</span>
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
                      <h2>{g?.title ?? r.name}</h2>
                      {g && (
                        <p className="small">
                          {r.name} · Hosted by {g.host.name}
                        </p>
                      )}
                      <p>{g?.description ?? r.description}</p>
                      <div className="chips">
                        {r.tags.map((tag) => (
                          <span className="badge" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      {g && (
                        <div className="selection-summary">
                          <strong>
                            {date(g.slot.startsAt)} · {time(g.slot.startsAt)}
                          </strong>
                          <span>
                            {g.capacity - g.members.length} seats left · {g.slot.discount}
                            % off
                          </span>
                        </div>
                      )}
                      <a
                        className="text-button"
                        href={`#/${g ? "groups/" + g.id : "restaurants/" + r.id}`}
                      >
                        {g ? "View party" : "View restaurant"} →
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
                  <p className="small muted swipe-hint">
                    Swipe, use the buttons, or focus the card and press ← / →.
                  </p>
                </>
              ) : results ? (
                <Empty
                  title="No more matches"
                  text="Try another search or a wider location radius."
                />
              ) : (
                <div className="empty discovery-welcome">
                  <h2>Your matches</h2>
                  <p>Enter your dining preferences to search.</p>
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
