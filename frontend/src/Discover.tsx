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
  const [mood, setMood] = useState(
      "A relaxed meal and friendly conversation after class",
    ),
    [mode, setMode] = useState("groups"),
    [area, setArea] = useState("any"),
    [radius, setRadius] = useState(15);
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
        area,
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
    setTab("saved");
    setBusy(true);
    setError("");
    try {
      setSaved((await api<{ results: Result[] }>("/discovery/saved")).results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
      setNotice(
        decision === "SAVE"
          ? "Saved to your shortlist. Open it when you’re ready to join."
          : "Skipped. You can undo your last swipe.",
      );
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
        <p className="eyebrow">EATOGETHER · FIND YOUR PEOPLE</p>
        <h1>Find your kind of table.</h1>
        <p>
          Tell us what you’re in the mood for. Discover open groups that fit,
          <br className="desktop-break" /> save a few favourites, then choose who to dine
          with.
        </p>
      </div>
      <div className="mode-tabs discovery-tabs">
        <button
          disabled={busy}
          className={tab === "discover" ? "selected" : ""}
          onClick={() => setTab("discover")}
        >
          Discover
        </button>
        <button
          disabled={busy}
          className={tab === "saved" ? "selected" : ""}
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
      {tab === "saved" ? (
        <>
          <p className="small muted">
            Saving keeps an idea for later. Availability can change until you join or
            book.
          </p>
          {busy ? (
            <p role="status">Loading your shortlist…</p>
          ) : saved.length ? (
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
                        {s.group ? "View group" : "View restaurant"} →
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
              title="Your next meal starts here"
              text="Save a card in Discover to build your shortlist."
            />
          )}
        </>
      ) : (
        <div className="discovery-layout">
          <aside className="panel mood-panel">
            <h2>What sounds good?</h2>
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
              <div className="mood-examples">
                {[
                  "Korean barbecue with new friends",
                  "Ice cream and a study break",
                  "A quiet Japanese lunch",
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    onClick={() => setMood(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label htmlFor="discovery-mode">Help me find</label>
              <select
                id="discovery-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="groups">An Eatogether party to join</option>
                <option value="restaurants">A restaurant for my next table</option>
              </select>
              <label htmlFor="discovery-area">Near</label>
              <select
                id="discovery-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="any">All locations</option>
                <option value="ntu">NTU</option>
                <option value="jurong">Jurong East</option>
                <option value="clementi">Clementi</option>
                <option value="city">City Hall</option>
              </select>
              {area !== "any" && (
                <>
                  <label htmlFor="radius">
                    Within {radius} km · straight-line distance
                  </label>
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
                {busy ? "Finding your table…" : "Find my matches →"}
              </button>
            </form>
            <p className="small muted">
              Tell us what you feel like eating. We’ll suggest available parties and
              restaurants that suit your mood and chosen area.
            </p>
          </aside>
          <section className="swipe-column" aria-label="Dining recommendations">
            {busy && !item ? (
              <div className="empty" role="status">
                <h3>Finding something you’ll enjoy…</h3>
                <p>Finding dining plans that suit your mood.</p>
              </div>
            ) : item && r ? (
              <>
                <div className="row small muted">
                  <span>{results?.length} ideas left</span>
                  <span>Ranked by your dining mood</span>
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
                          {g.capacity - g.members.length} seats left · {g.slot.discount}%
                          off
                        </span>
                      </div>
                    )}
                    <a
                      className="text-button"
                      href={`#/${g ? "groups/" + g.id : "restaurants/" + r.id}`}
                    >
                      {g ? "Meet the party & join" : "See times & start a group"} →
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
                title="You’ve seen the available options"
                text="Check your shortlist, widen the area, or switch to restaurants to start your own group. Saved and skipped options stay out of new searches."
              />
            ) : (
              <div className="discovery-welcome">
                <span>✳</span>
                <h2>
                  A shared craving.
                  <br />A new connection.
                </h2>
                <p>
                  Start with a mood, not a menu.
                  <br />
                  We’ll find open tables worth exploring.
                </p>
                <p className="small">
                  Save means interested. Joining is always your choice.
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
    </>
  );
}
