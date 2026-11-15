import { useEffect, useState, type FormEvent } from "react";
import type { Group, Slot, Restaurant, User } from "./types";
import { api } from "./api";
import { AccountMenu } from "./AccountMenu";
import { Footer } from "./Footer";
import { Pagination } from "./Pagination";
import { State, Status, date, time, useResource, type Actions } from "./dining-ui";
import { useContentMotion } from "./motion";
import { EventChat } from "./EventSocial";
import { RestaurantMenu } from "./RestaurantMenu";
import { EventPreferences } from "./EventPreferences";

type BusinessSlot = Slot & { discountedSeats: number | null; heldSeats: number };
type Reservation = {
  id: string;
  partySize: number;
  status: string;
  discount: number | null;
  user: { name: string };
  slot: Slot;
  group: { id: string; title: string } | null;
};
type Dashboard = {
  restaurant: Restaurant;
  slots: BusinessSlot[];
  groups: Group[];
  bookings: Reservation[];
};
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const eventPrice = (g: Group) =>
  g.status === "PRICE_DECISION"
    ? "Price choices pending"
    : g.discount === 0
      ? "Full price"
      : `${g.discount}% off`;

export function BusinessApp({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => Promise<void>;
}) {
  const [route, setRoute] = useState(
    window.location.hash.slice(1) || "/business/reservations",
  );
  const [day, setDay] = useState(today),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [page, setPage] = useState(0),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash.slice(1) || "/business/reservations");
      setPage(0);
      setCreating(false);
      setError("");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const resource = useResource<Dashboard>(
    `/business/dashboard?date=${encodeURIComponent(day)}`,
    revision,
  );
  const parts = route.split("/").filter(Boolean),
    view = parts[1] || "reservations",
    id = parts[2];
  const content = useContentMotion<HTMLDivElement>(`${view}:${id ?? ""}:${day}:${page}`);
  const actions: Actions = {
    revision,
    busy,
    act: async <T,>(
      path: string,
      body: unknown,
      success: string,
      destination?: string | ((data: T) => string),
    ) => {
      setBusy(true);
      setError("");
      try {
        const data = await api<T>(path, body);
        setRevision((n) => n + 1);
        setMessage(success);
        if (destination)
          window.location.hash =
            typeof destination === "function" ? destination(data) : destination;
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
  const dashboard = resource.data;
  const confirmed = dashboard?.bookings.filter((b) => b.status === "CONFIRMED") ?? [];
  const bookedDiners = confirmed.reduce((total, b) => total + b.partySize, 0);
  function chooseDay(value: string) {
    if (!value) return;
    setDay(value);
    setPage(0);
    setCreating(false);
  }
  function moveDay(offset: number) {
    chooseDay(
      new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  }
  const records =
    view === "events"
      ? (dashboard?.groups ?? [])
      : view === "slots"
        ? (dashboard?.slots ?? [])
        : (dashboard?.bookings ?? []);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(records.length / 3) - 1));
  return (
    <>
      <div className="topbar">
        <header className="app-header">
          <a className="brand" href="#/business/reservations">
            <img src="/images/brand/eatigo.png" alt="Eatigo" />
          </a>
          <span className="business-label">Restaurant</span>
          <AccountMenu
            user={user}
            busy={busy}
            onLogout={async () => {
              setBusy(true);
              try {
                await onLogout();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          />
        </header>
      </div>
      <main className="app-main business-main">
        {message && (
          <div className="toast" role="status">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div ref={content}>
          {id && view === "events" ? (
            <BusinessEvent id={id} user={user} {...actions} />
          ) : (
            <>
              <section className="page-intro business-intro">
                <div className="business-identity">
                  <div className="business-venue-image" aria-hidden="true">
                    {dashboard?.restaurant.imagePath ? (
                      <img src={dashboard.restaurant.imagePath} alt="" />
                    ) : (
                      user.restaurant?.name[0]
                    )}
                  </div>
                  <div>
                    <h1>{user.restaurant?.name}</h1>
                    {dashboard?.restaurant.area && (
                      <p className="small">{dashboard.restaurant.area}</p>
                    )}
                    <span className="profile-verification">✓ Corppass verified</span>
                  </div>
                </div>
                {view !== "profile" && (
                  <div className="business-date">
                    <label htmlFor="business-day">Dining date</label>
                    <div>
                      <button
                        className="secondary date-step"
                        aria-label="Previous dining date"
                        onClick={() => moveDay(-1)}
                      >
                        ‹
                      </button>
                      <input
                        id="business-day"
                        type="date"
                        value={day}
                        onInput={(e) => chooseDay(e.currentTarget.value)}
                        onChange={(e) => chooseDay(e.target.value)}
                      />
                      <button
                        className="secondary date-step"
                        aria-label="Next dining date"
                        onClick={() => moveDay(1)}
                      >
                        ›
                      </button>
                      {day !== today() && (
                        <button
                          className="text-button"
                          onClick={() => chooseDay(today())}
                        >
                          Today
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
              {view === "profile" ? (
                <section className="panel">
                  <h2>Restaurant profile</h2>
                  <p>{user.restaurant?.address}</p>
                  <p>{user.email}</p>
                  <RestaurantMenu
                    restaurantId={user.restaurant!.id}
                    restaurantName={user.restaurant!.name}
                    discount={0}
                  />
                </section>
              ) : (
                <>
                  <nav
                    className="mode-tabs business-tabs"
                    aria-label="Restaurant sections"
                  >
                    {[
                      ["reservations", "Reservations"],
                      ["events", "EatTogether"],
                      ["slots", "Slots"],
                    ].map(([key, label]) => (
                      <a
                        key={key}
                        className={view === key ? "selected" : ""}
                        aria-current={view === key ? "page" : undefined}
                        href={`#/business/${key}`}
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                  <State data={dashboard} error={resource.error}>
                    {dashboard && (
                      <>
                        {view === "events" ? (
                          <>
                            <div className="section-heading">
                              <div>
                                <h2>EatTogether Events</h2>
                                <p className="small muted">
                                  Diner and restaurant-hosted tables
                                </p>
                              </div>
                              <button
                                disabled={
                                  busy || !dashboard.restaurant.eatTogetherEnabled
                                }
                                onClick={() => setCreating(!creating)}
                              >
                                {creating ? "Close form" : "Create Restaurant Event"}
                              </button>
                            </div>
                            {creating && (
                              <EventEditor
                                slots={dashboard.slots}
                                {...actions}
                                onCreated={() => setCreating(false)}
                              />
                            )}
                            <div className="business-list">
                              {dashboard.groups
                                .slice(currentPage * 3, (currentPage + 1) * 3)
                                .map((g) => (
                                  <article className="panel business-row" key={g.id}>
                                    <div>
                                      <h3>{g.title}</h3>
                                      <p className="small business-event-meta">
                                        {time(g.slot.startsAt)} ·{" "}
                                        {g.restaurantHosted
                                          ? "Restaurant Event"
                                          : "Diner Event"}{" "}
                                        · {eventPrice(g)}
                                      </p>
                                      <p className="small">
                                        {g.members.reduce((n, m) => n + m.partySize, 0)} /{" "}
                                        {g.capacity} diners · Minimum{" "}
                                        {g.slot.minimumPartySize}
                                      </p>
                                    </div>
                                    <div>
                                      <Status value={g.status} />
                                      <a
                                        className="button secondary"
                                        href={`#/business/events/${g.id}`}
                                      >
                                        View Event →
                                      </a>
                                    </div>
                                  </article>
                                ))}
                            </div>
                          </>
                        ) : view === "slots" ? (
                          <>
                            <div className="section-heading">
                              <h2>Dining slots</h2>
                              <label className="inline-check">
                                <input
                                  type="checkbox"
                                  checked={
                                    dashboard.restaurant.eatTogetherEnabled !== false
                                  }
                                  disabled={busy}
                                  onChange={(e) =>
                                    void actions.act(
                                      "/business/settings",
                                      { eatTogetherEnabled: e.target.checked },
                                      "EatTogether availability updated.",
                                    )
                                  }
                                />
                                EatTogether enabled
                              </label>
                            </div>
                            <p className="small muted">
                              Availability changes apply to new Events. Existing diners
                              keep their reservations.
                            </p>
                            <div className="business-list">
                              {dashboard.slots
                                .slice(currentPage * 3, (currentPage + 1) * 3)
                                .map((s) => (
                                  <SlotEditor key={s.id} slot={s} {...actions} />
                                ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="section-heading">
                              <h2>Reservations</h2>
                              <span className="small muted">
                                {confirmed.length} confirmed · {bookedDiners} diners
                              </span>
                            </div>
                            <div className="business-list reservation-list">
                              {!!dashboard.bookings.length && (
                                <div className="reservation-columns" aria-hidden="true">
                                  <span>Time</span>
                                  <span>Reservation</span>
                                  <span>Diners</span>
                                  <span>Status</span>
                                </div>
                              )}
                              {dashboard.bookings
                                .slice(currentPage * 3, (currentPage + 1) * 3)
                                .map((b) => (
                                  <article className="reservation-entry" key={b.id}>
                                    <strong className="reservation-time">
                                      {time(b.slot.startsAt)}
                                    </strong>
                                    <div className="reservation-description">
                                      <h3>{b.group ? b.group.title : b.user.name}</h3>
                                      <p className="small muted">
                                        {b.group ? "EatTogether" : "Table booking"} · #
                                        {b.id.slice(0, 8).toUpperCase()}
                                      </p>
                                      <p className="small">
                                        {(b.discount ?? b.slot.discount) === 0
                                          ? "Full price"
                                          : `${b.discount ?? b.slot.discount}% off`}
                                      </p>
                                    </div>
                                    <div className="reservation-diners">
                                      <strong>{b.partySize}</strong>
                                      <span className="small muted"> diners</span>
                                    </div>
                                    <div className="reservation-actions">
                                      <Status value={b.status} />
                                      {b.group && (
                                        <a
                                          className="button secondary"
                                          href={`#/business/events/${b.group.id}`}
                                        >
                                          View Event →
                                        </a>
                                      )}
                                      {!b.group && (
                                        <span className="small muted">Private table</span>
                                      )}
                                    </div>
                                  </article>
                                ))}
                            </div>
                          </>
                        )}
                        {!records.length && (
                          <p className="empty">
                            No{" "}
                            {view === "events"
                              ? "Events"
                              : view === "slots"
                                ? "slots"
                                : "reservations"}{" "}
                            on this date.
                          </p>
                        )}
                        <Pagination
                          total={records.length}
                          page={currentPage}
                          pageSize={3}
                          onPageChange={setPage}
                          label={
                            view === "events"
                              ? "Events"
                              : view === "slots"
                                ? "Slots"
                                : "Reservations"
                          }
                        />
                      </>
                    )}
                  </State>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function SlotEditor({ slot, ...actions }: Actions & { slot: BusinessSlot }) {
  const [minimum, setMinimum] = useState(slot.minimumPartySize),
    [capacity, setCapacity] = useState(slot.capacity),
    [seats, setSeats] = useState(slot.discountedSeats ?? slot.capacity),
    [discount, setDiscount] = useState(slot.discount),
    [enabled, setEnabled] = useState(slot.eatTogetherEnabled !== false);
  const past = Date.parse(slot.startsAt) <= Date.now(),
    protectedSlot = slot.heldSeats > 0;
  return (
    <details className="panel business-slot">
      <summary>
        <div>
          <strong>{time(slot.startsAt)}</strong>
          <span className="slot-availability">
            {past
              ? "Past dining time"
              : enabled
                ? "EatTogether enabled"
                : "EatTogether excluded"}
          </span>
        </div>
        <span>
          {slot.discount}% off · {slot.availableSeats} free /{" "}
          {slot.discountedSeats ?? slot.capacity} seats{" "}
          <span aria-hidden="true" className="slot-chevron">
            ⌄
          </span>
        </span>
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await actions.act(
            `/business/slots/${slot.id}`,
            {
              minimumPartySize: minimum,
              capacity,
              discountedSeats: seats,
              discount,
              eatTogetherEnabled: enabled,
            },
            "Slot settings saved.",
          );
        }}
      >
        {(protectedSlot || past) && (
          <p className="small muted">
            {past
              ? "This dining time has passed."
              : "This slot has allocated seats. Prices and seat limits are protected."}
          </p>
        )}
        <fieldset
          className="business-fields"
          disabled={actions.busy || past || protectedSlot}
        >
          <label>
            Minimum Party Size
            <input
              type="number"
              min={1}
              max={20}
              value={minimum}
              onChange={(e) => setMinimum(Number(e.target.value))}
            />
          </label>
          <label>
            Maximum table size
            <input
              type="number"
              min={minimum}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
          <label>
            Discounted seats
            <input
              type="number"
              min={capacity}
              max={200}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </label>
          <label>
            Discount (%)
            <input
              type="number"
              min={10}
              max={50}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </label>
        </fieldset>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={enabled}
            disabled={actions.busy || past}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Allow new EatTogether Events
        </label>
        <button disabled={actions.busy || past}>Save slot</button>
      </form>
    </details>
  );
}

function EventEditor({
  slots,
  onCreated,
  ...actions
}: Actions & { slots: BusinessSlot[]; onCreated: () => void }) {
  const eligible = slots.filter(
    (s) =>
      Date.parse(s.startsAt) > Date.now() + 2 * 3600000 &&
      s.eatTogetherEnabled !== false &&
      s.availableSeats! >= s.minimumPartySize &&
      s.minimumPartySize > 1,
  );
  const [slotId, setSlotId] = useState(eligible[0]?.id ?? ""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [theme, setTheme] = useState(""),
    [gender, setGender] = useState(""),
    [minAge, setMinAge] = useState(""),
    [maxAge, setMaxAge] = useState("");
  const slot = eligible.find((s) => s.id === slotId) ?? eligible[0];
  const [minimum, setMinimum] = useState(slot?.minimumPartySize ?? 2),
    [capacity, setCapacity] = useState(
      Math.min(slot?.capacity ?? 4, slot?.availableSeats ?? 4),
    ),
    [discount, setDiscount] = useState(slot?.discount ?? 30);
  if (!slot)
    return (
      <p className="note">
        No eligible slots before Cutoff. A Restaurant Event must hold its whole table from
        creation.
      </p>
    );
  return (
    <form
      className="panel business-event-form"
      onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        if (
          await actions.act<{ group: Group }>(
            "/business/events",
            {
              slotId: slot.id,
              title,
              description,
              theme,
              genderFilter: theme ? gender || null : null,
              minAge: theme && minAge ? Number(minAge) : null,
              maxAge: theme && maxAge ? Number(maxAge) : null,
              minimumPartySize: minimum,
              capacity,
              discount,
            },
            "Restaurant Event created.",
            (result) => `/business/events/${result.group.id}`,
          )
        )
          onCreated();
      }}
    >
      <h3>Create Restaurant Event</h3>
      <label>
        Dining time
        <select
          value={slot.id}
          onChange={(e) => {
            setSlotId(e.target.value);
            const next = eligible.find((s) => s.id === e.target.value)!;
            setMinimum(next.minimumPartySize);
            setCapacity(Math.min(next.capacity, next.availableSeats ?? next.capacity));
            setDiscount(next.discount);
          }}
        >
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {time(s.startsAt)} · {s.availableSeats} free seats
            </option>
          ))}
        </select>
      </label>
      <label>
        Event name
        <input
          required
          maxLength={80}
          placeholder="Event name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Host’s note
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Note for diners"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="business-fields">
        <label>
          Minimum Party Size
          <input
            type="number"
            required
            min={2}
            max={capacity}
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          />
        </label>
        <label>
          Event Capacity
          <input
            type="number"
            required
            min={minimum}
            max={Math.min(slot.capacity, slot.availableSeats ?? 0)}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </label>
        <label>
          Discount (%)
          <input
            type="number"
            required
            min={10}
            max={50}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </label>
      </div>
      <details>
        <summary>
          Themed Event <span className="muted">(optional)</span>
        </summary>
        <label>
          Theme
          <input
            maxLength={80}
            placeholder="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
        </label>
        {theme.trim() && (
          <>
            <p className="small muted">Event Filters are fixed after creation.</p>
            <div className="business-fields">
              <label>
                Gender
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">All genders</option>
                  <option value="FEMALE">Women</option>
                  <option value="MALE">Men</option>
                </select>
              </label>
              <label>
                Minimum age
                <input
                  type="number"
                  min={18}
                  max={120}
                  placeholder="18"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                />
              </label>
              <label>
                Maximum age
                <input
                  type="number"
                  min={Number(minAge) || 18}
                  max={120}
                  placeholder="No limit"
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </details>
      <p className="small muted">
        All {capacity} seats are held immediately. Cutoff is{" "}
        {time(new Date(Date.parse(slot.startsAt) - 2 * 3600000).toISOString())}.
      </p>
      <button disabled={actions.busy || !title.trim()}>Create Event</button>
    </form>
  );
}

function BusinessEvent({ id, user, ...actions }: Actions & { id: string; user: User }) {
  const resource = useResource<{
    group: Group;
    feedback: {
      count: number;
      overall: number | null;
      social: number | null;
      meal: number | null;
      safe: number;
      dineAgain: number;
    } | null;
  }>(`/business/events/${encodeURIComponent(id)}`, actions.revision);
  const [noShow, setNoShow] = useState<string | null>(null),
    [withdraw, setWithdraw] = useState(false),
    [chat, setChat] = useState(false);
  const g = resource.data?.group,
    started = g && Date.parse(g.slot.startsAt) <= Date.now(),
    canRecord =
      started &&
      g?.booking?.status === "CONFIRMED" &&
      ["CONFIRMED", "FULL_PRICE"].includes(g.status);
  return (
    <>
      <a className="back" href="#/business/events">
        ← EatTogether Events
      </a>
      <State data={resource.data} error={resource.error}>
        {g && (
          <>
            <section className="page-intro">
              <div>
                <h1>{g.title}</h1>
                <p>
                  {date(g.slot.startsAt)} · {time(g.slot.startsAt)} ·{" "}
                  {g.restaurantHosted ? "Restaurant Event" : "Diner Event"}
                </p>
              </div>
              <Status value={g.status} />
            </section>
            <div className="business-event-layout">
              <div className="business-event-main">
                {(g.description || g.theme) && (
                  <section className="panel business-event-note">
                    <h2>{g.restaurantHosted ? "Restaurant note" : "Host’s note"}</h2>
                    {g.description && <p>{g.description}</p>}
                    {g.theme && <p className="small">Theme: {g.theme}</p>}
                    <EventPreferences event={g} />
                  </section>
                )}
                <section className="panel">
                  <div className="row">
                    <h2>Diners</h2>
                    <span className="small muted">
                      {g.members.reduce((n, m) => n + m.partySize, 0)} booked
                    </span>
                  </div>
                  {!g.members.length ? (
                    <p>No diners have Joined yet.</p>
                  ) : (
                    g.members.map((m) => (
                      <div key={m.userId} className="attendance-row">
                        <div className="attendance-person">
                          <span className="avatar" aria-hidden="true">
                            {m.user.name[0]}
                          </span>
                          <div>
                            <strong>{m.user.name}</strong>
                            {m.userId === g.hostId && (
                              <span className="small muted"> · Host</span>
                            )}
                            <p className="small">
                              {m.attendance === "ATTENDED"
                                ? "Attended"
                                : m.attendance === "NO_SHOW"
                                  ? "No-show"
                                  : "Attendance not recorded"}
                            </p>
                          </div>
                        </div>
                        {canRecord && (
                          <div className="attendance-actions">
                            <button
                              className={`secondary ${m.attendance === "ATTENDED" ? "attendance-recorded" : ""}`}
                              disabled={actions.busy || m.attendance === "ATTENDED"}
                              onClick={() =>
                                void actions.act(
                                  `/business/events/${id}/attendance`,
                                  { userId: m.userId, status: "ATTENDED" },
                                  "Attendance recorded.",
                                )
                              }
                            >
                              Attended
                            </button>
                            <button
                              className="text-button danger-text"
                              disabled={actions.busy || m.attendance === "NO_SHOW"}
                              onClick={() => setNoShow(m.userId)}
                            >
                              No-show
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {!started && (
                    <p className="small muted">Attendance opens at dining time.</p>
                  )}
                  {noShow && (
                    <div className="cancel-prompt">
                      <p>
                        Record {g.members.find((m) => m.userId === noShow)?.user.name} as
                        a no-show? This adds one private reliability strike. You can
                        correct the attendance later.
                      </p>
                      <button
                        className="danger"
                        disabled={actions.busy}
                        onClick={async () => {
                          if (
                            await actions.act(
                              `/business/events/${id}/attendance`,
                              { userId: noShow, status: "NO_SHOW" },
                              "No-show recorded.",
                            )
                          )
                            setNoShow(null);
                        }}
                      >
                        Confirm no-show
                      </button>
                      <button className="text-button" onClick={() => setNoShow(null)}>
                        Back
                      </button>
                    </div>
                  )}
                </section>
              </div>
              <aside className="panel">
                <h2>Event details</h2>
                <p>
                  {g.members.reduce((n, m) => n + m.partySize, 0)} / {g.capacity} diners
                </p>
                <p>Minimum Party Size: {g.slot.minimumPartySize}</p>
                <p>{eventPrice(g)}</p>
                <p className="small">
                  Cutoff: {g.cutoffAt ? `${date(g.cutoffAt)} · ${time(g.cutoffAt)}` : "—"}
                </p>
                <dl className="business-detail-list seat-summary">
                  <div>
                    <dt>Initially held</dt>
                    <dd>{g.initialHeldSeats ?? 0} seats</dd>
                  </div>
                  <div>
                    <dt>Currently held</dt>
                    <dd>{g.heldSeats ?? 0} seats</dd>
                  </div>
                  <div>
                    <dt>Released at Cutoff</dt>
                    <dd>
                      {g.cutoffProcessed
                        ? `${g.releasedAtCutoff ?? 0} seats`
                        : "Cutoff not reached"}
                    </dd>
                  </div>
                </dl>
                <p className="small muted">
                  At Cutoff, unused Held Seats return to the restaurant. A short Event
                  offers full price or a penalty-free decline. Later Joins can only
                  replace departures.
                </p>
                <RestaurantMenu
                  restaurantId={g.slot.restaurant.id}
                  restaurantName={g.slot.restaurant.name}
                  discount={g.discount}
                />
                {g.restaurantHosted &&
                  !started &&
                  !g.members.length &&
                  !["CANCELLED", "EXPIRED"].includes(g.status) &&
                  (withdraw ? (
                    <div className="cancel-prompt">
                      <p>Withdraw this empty Event and release its Held Seats?</p>
                      <button
                        className="danger"
                        disabled={actions.busy}
                        onClick={() =>
                          void actions.act(
                            `/business/events/${id}/withdraw`,
                            {},
                            "Event withdrawn.",
                            "/business/events",
                          )
                        }
                      >
                        Confirm withdrawal
                      </button>
                      <button className="text-button" onClick={() => setWithdraw(false)}>
                        Keep Event
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button danger-text"
                      onClick={() => setWithdraw(true)}
                    >
                      Withdraw empty Event
                    </button>
                  ))}
              </aside>
            </div>
            {g.restaurantHosted && g.chatOpenedAt && (
              <details
                className="panel business-chat"
                onToggle={(e) => setChat(e.currentTarget.open)}
              >
                <summary>Event Chat</summary>
                {chat && (
                  <EventChat
                    group={g}
                    user={user}
                    basePath={`/business/events/${id}`}
                    {...actions}
                  />
                )}
              </details>
            )}
            {g.restaurantHosted && (started || !!resource.data?.feedback?.count) && (
              <section className="panel feedback-summary">
                <h2>Event Feedback</h2>
                {resource.data?.feedback?.count ? (
                  <>
                    <p className="small">
                      {resource.data.feedback.count} private responses · averages only
                    </p>
                    <div className="business-fields">
                      {[
                        ["Overall", resource.data.feedback.overall],
                        ["Social experience", resource.data.feedback.social],
                        ["Meal", resource.data.feedback.meal],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <span className="small muted">{label}</span>
                          <p>
                            <strong>
                              {typeof value === "number" ? value.toFixed(1) : "—"} / 5
                            </strong>
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="small">
                      Felt safe:{" "}
                      {Math.round(
                        (resource.data.feedback.safe / resource.data.feedback.count) *
                          100,
                      )}
                      % · Would dine again:{" "}
                      {Math.round(
                        (resource.data.feedback.dineAgain /
                          resource.data.feedback.count) *
                          100,
                      )}
                      %
                    </p>
                  </>
                ) : (
                  <p className="small muted">No feedback yet.</p>
                )}
              </section>
            )}
          </>
        )}
      </State>
    </>
  );
}
