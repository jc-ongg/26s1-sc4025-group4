import { useState, type FormEvent } from "react";
import { TopPicks } from "./TopPicks";
import { RestaurantMap } from "./RestaurantMap";
import type { Restaurant, Group } from "./types";
import { availableSlots, hasStarted } from "./availability";
import { Art, Empty, State, date, time, useResource, type Actions } from "./dining-ui";

export function Restaurants({ revision }: Actions) {
  const { data, error } = useResource<{ restaurants: Restaurant[] }>(
    "/restaurants",
    revision,
  );
  const [search, setSearch] = useState(""),
    [cuisine, setCuisine] = useState("All");
  const groupResource = useResource<{ groups: Group[] }>("/groups", revision);
  const groups =
    groupResource.data?.groups.filter(
      (g) => g.status === "OPEN" && g.members.length < g.capacity,
    ) ?? [];
  const [view, setView] = useState<"grid" | "map">("grid");
  const filtered = data?.restaurants.filter(
    (r) =>
      (cuisine === "All" || r.cuisine === cuisine) &&
      `${r.name} ${r.area} ${r.cuisine}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      {data && <TopPicks restaurants={data.restaurants} />}
      <section className="restaurant-browse">
        <div className="section-heading">
          <div>
            <h2>Explore restaurants</h2>
          </div>
          <span className="muted small">{filtered?.length ?? 0} restaurants</span>
        </div>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="Search restaurants"
            placeholder="Restaurant, cuisine or neighbourhood"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="chips" aria-label="Cuisine filters">
          {["All", ...new Set(data?.restaurants.map((r) => r.cuisine) ?? [])].map(
            (item) => (
              <button
                className={`chip ${cuisine === item ? "active" : ""}`}
                key={item}
                aria-pressed={cuisine === item}
                onClick={() => setCuisine(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <div className="browse-toolbar">
          <div className="mode-tabs">
            <button
              aria-pressed={view === "grid"}
              className={view === "grid" ? "selected" : ""}
              onClick={() => setView("grid")}
            >
              Restaurant view
            </button>
            <button
              aria-pressed={view === "map"}
              className={view === "map" ? "selected" : ""}
              onClick={() => setView("map")}
            >
              Map view
            </button>
          </div>
        </div>
        {view === "map" && groupResource.error && (
          <p className="error">Group availability is temporarily unavailable.</p>
        )}
        <State data={data} error={error}>
          {view === "map" ? (
            <RestaurantMap restaurants={filtered ?? []} groups={groups} />
          ) : (
            <div className="grid">
              {filtered?.map((r) => {
                const slots = availableSlots(r);
                return (
                  <a className="card" href={`#/restaurants/${r.id}`} key={r.id}>
                    <Art restaurant={r} />
                    <div className="card-body">
                      <div className="row">
                        <span className="eyebrow">{r.cuisine}</span>
                        <span className="small muted">{r.price}</span>
                      </div>
                      <h3>{r.name}</h3>
                      <p className="small">{r.area}</p>
                      <div className="row">
                        <span className="discount">
                          {slots.length
                            ? `Up to ${Math.max(...slots.map((s) => s.discount))}% off`
                            : "No available times"}
                        </span>
                        <span className="small">View restaurant →</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
          {filtered?.length === 0 && (
            <Empty
              title="No restaurants found"
              text="Try another cuisine, restaurant name or neighbourhood."
            />
          )}
        </State>
      </section>
    </>
  );
}

export function RestaurantDetail({ id, revision, busy, act }: Actions & { id: string }) {
  const { data, error } = useResource<{ restaurant: Restaurant }>(
    `/restaurants/${encodeURIComponent(id)}`,
    revision,
  );
  const [selectedDay, setSelectedDay] = useState("");
  const [selected, setSelected] = useState(""),
    [mode, setMode] = useState<"group" | "booking">("booking");
  const [capacity, setCapacity] = useState(4),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState("");
  const r = data?.restaurant,
    slot = r && availableSlots(r).find((s) => s.id === selected);
  const days = Array.from(new Set(r?.slots.map((s) => date(s.startsAt)) ?? []));
  const chosenDay = days.includes(selectedDay) ? selectedDay : days[0];
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!slot || busy || (mode === "group" && !title.trim())) return;
    if (mode === "group")
      await act<{ group: Group }>(
        "/groups",
        { slotId: slot.id, capacity, title, description },
        "Your table is open. Invite someone to join.",
        (data) => `/groups/${data.group.id}`,
      );
    else
      await act(
        "/bookings",
        { slotId: slot.id, partySize: capacity },
        "Your reservation is confirmed.",
        "/bookings",
      );
  }
  return (
    <>
      <a className="back" href="#/restaurants">
        ← All restaurants
      </a>
      <State data={data} error={error}>
        {r && (
          <>
            <div className="restaurant-banner">
              <Art restaurant={r} large />
              <div className="restaurant-heading">
                <p className="eyebrow">
                  {r.cuisine} · {r.area} · {r.price}
                </p>
                <h1>{r.name}</h1>
                <p>{r.description}</p>
                <p className="small">{r.address}</p>
                <div className="chips">
                  {r.tags?.map((tag) => (
                    <span className="badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="detail-layout">
              <section>
                <h2>At the table</h2>
                {!r.active && (
                  <p className="note">
                    This restaurant is no longer accepting reservations.
                  </p>
                )}
                <p>{r.signatureDishes?.join(" · ")}</p>
                <h2>Available times</h2>
                <p className="small">Singapore time</p>
                <label className="date-label" htmlFor="dining-date">
                  Dining date
                </label>
                <select
                  id="dining-date"
                  value={chosenDay ?? ""}
                  disabled={!days.length}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setSelected("");
                  }}
                >
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <div className="slot-days">
                  {days
                    .filter((day) => day === chosenDay)
                    .map((day) => (
                      <section key={day}>
                        <h3 className="day-heading">{day}</h3>
                        <div className="slot-grid">
                          {r.slots
                            .filter((s) => date(s.startsAt) === day)
                            .map((s) => (
                              <button
                                key={s.id}
                                className={`slot ${selected === s.id ? "selected" : ""}`}
                                disabled={
                                  !r.active ||
                                  !!s.allocation ||
                                  hasStarted(s.startsAt) ||
                                  busy
                                }
                                aria-pressed={selected === s.id}
                                onClick={() => {
                                  setSelected(s.id);
                                  setCapacity(s.capacity);
                                }}
                              >
                                <strong>{time(s.startsAt)}</strong>
                                <span>
                                  {hasStarted(s.startsAt)
                                    ? "Unavailable"
                                    : s.allocation
                                      ? "Reserved"
                                      : `${s.discount}% off`}
                                </span>
                              </button>
                            ))}
                        </div>
                      </section>
                    ))}
                </div>
                {r.slots.length === 0 && (
                  <Empty
                    title="No upcoming slots"
                    text="Try another restaurant or check back later."
                  />
                )}
              </section>
              <aside className="panel booking-panel">
                <h2>Make a plan</h2>
                <div className="mode-tabs">
                  <button
                    type="button"
                    disabled={busy}
                    className={mode === "booking" ? "selected" : ""}
                    aria-pressed={mode === "booking"}
                    onClick={() => setMode("booking")}
                  >
                    Book
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={mode === "group" ? "selected" : ""}
                    aria-pressed={mode === "group"}
                    onClick={() => setMode("group")}
                  >
                    Eatogether
                  </button>
                </div>
                <p className="small">
                  {mode === "group"
                    ? "Open your table to other diners. You take the first seat and confirm when your group is ready."
                    : "Choose a time and reserve a table."}
                </p>
                <form onSubmit={submit}>
                  {slot ? (
                    <div className="selection-summary">
                      <strong>
                        {date(slot.startsAt)} · {time(slot.startsAt)}
                      </strong>
                      <span>
                        {slot.discount}% off · minimum {slot.minimumPartySize} diners
                      </span>
                    </div>
                  ) : (
                    <p className="note" role="status">
                      {selected
                        ? "That slot is no longer available. Choose another time."
                        : "Select an available time to get started."}
                    </p>
                  )}
                  <label htmlFor="party-size">
                    {mode === "group"
                      ? "Seats at your table (including you)"
                      : "Party size"}
                  </label>
                  <select
                    id="party-size"
                    value={capacity}
                    disabled={!slot || busy}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  >
                    {Array.from(
                      {
                        length: slot ? slot.capacity - slot.minimumPartySize + 1 : 1,
                      },
                      (_, i) => (slot ? slot.minimumPartySize + i : 4),
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} diners
                      </option>
                    ))}
                  </select>
                  {mode === "group" && (
                    <>
                      <label htmlFor="group-title">Give your table a name</label>
                      <input
                        id="group-title"
                        required
                        maxLength={80}
                        placeholder="A relaxed Friday dinner"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <label htmlFor="group-description">
                        A note for your guests <span className="muted">(optional)</span>
                      </label>
                      <textarea
                        id="group-description"
                        maxLength={500}
                        rows={3}
                        placeholder="What kind of meal do you have in mind?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </>
                  )}
                  <button disabled={!slot || busy || (mode === "group" && !title.trim())}>
                    {busy
                      ? "Saving…"
                      : mode === "group"
                        ? "Create Eatogether party"
                        : "Confirm reservation"}
                  </button>
                </form>
              </aside>
            </div>
          </>
        )}
      </State>
    </>
  );
}
