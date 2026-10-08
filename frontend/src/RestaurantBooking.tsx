import { useRef, useState, type FormEvent } from "react";
import type { Gender, Group, Restaurant, User } from "./types";
import { EventPreferences } from "./EventPreferences";
import { dinerCount, hasStarted } from "./availability";
import { slotState, eventJoinState } from "./booking-flow";
import { eventDisplayStatus } from "./booking-history";
import { Status, date, time, type Actions } from "./dining-ui";

export function RestaurantBooking({
  restaurant: r,
  groups,
  user,
  busy,
  act,
}: Actions & { restaurant: Restaurant; groups: Group[]; user: User }) {
  const [selectedDay, setSelectedDay] = useState("");
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"booking" | "group">("booking");
  const [partySize, setPartySize] = useState(2);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genderFilter, setGenderFilter] = useState<Gender | "">("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const panel = useRef<HTMLElement>(null);
  const now = Date.now();
  const slots = r.slots.filter((s) => !hasStarted(s.startsAt, now));
  const days = [...new Set(slots.map((s) => date(s.startsAt)))];
  const chosenDay = days.includes(selectedDay) ? selectedDay : days[0];
  const daySlots = slots.filter((s) => date(s.startsAt) === chosenDay);
  const slot = daySlots.find((s) => s.id === selected);
  // Only the Event currently holding the table is relevant; cancelled history must
  // never block a new reservation or be mistaken for the current Event.
  const existing = groups.find((g) => g.id === slot?.allocation?.groupId);
  const yourParty = existing?.members.find((party) => party.userId === user.id);
  const dayEvents = groups.filter((g) =>
    daySlots.some((s) => s.allocation?.groupId === g.id),
  );
  const state = slot && slotState(slot, r.active, now);
  const joinState = existing && eventJoinState(existing, 1, user.id, now);
  const selectedPartySize = mode === "group" ? 1 : partySize;
  const validParty =
    !!slot && selectedPartySize >= 1 && selectedPartySize <= slot.capacity;
  const canBook =
    state === "available" && validParty && partySize >= slot!.minimumPartySize;
  const canCreate =
    state === "available" && slot!.minimumPartySize > 1 && user.singpassVerified;

  function chooseTime(id: string, event = false) {
    setSelected(id);
    setCreating(false);
    setMode(event ? "group" : "booking");
    // On phones the options sit below the time list. Reveal them only after an
    // explicit selection, never during polling or a background availability update.
    if (window.matchMedia("(max-width: 800px)").matches) {
      requestAnimationFrame(() =>
        panel.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !slot) return;
    if (mode === "booking" && canBook) {
      await act(
        "/bookings",
        { slotId: slot.id, partySize },
        "Your reservation is confirmed.",
        "/bookings",
      );
    } else if (mode === "group" && canCreate && creating && title.trim()) {
      await act<{ group: Group }>(
        "/groups",
        {
          slotId: slot.id,
          capacity: slot.capacity,
          partySize: 1,
          title: title.trim(),
          description: description.trim(),
          genderFilter: genderFilter || null,
          minAge: minAge ? Number(minAge) : null,
          maxAge: maxAge ? Number(maxAge) : null,
        },
        "Your EatTogether Event has been created.",
        (result) => `/groups/${result.group.id}`,
      );
    }
  }

  return (
    <div className="detail-layout reservation-flow">
      <section aria-label="Dining times">
        <h2>Choose a time</h2>
        {!r.active && (
          <p className="note">This restaurant is no longer accepting reservations.</p>
        )}
        {days.length ? (
          <>
            <label className="date-label" htmlFor="dining-date">
              Dining date
            </label>
            <select
              id="dining-date"
              value={chosenDay}
              disabled={busy}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setSelected("");
                setCreating(false);
                setMode("booking");
              }}
            >
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <p className="small muted time-zone">Singapore time</p>
            <div className="slot-grid">
              {daySlots.map((s) => {
                const availability = slotState(s, r.active, now);
                const event = groups.find((g) => g.id === s.allocation?.groupId);
                const remaining = event ? event.capacity - dinerCount(event) : 0;
                return (
                  <button
                    key={s.id}
                    className={`slot ${selected === s.id ? "selected" : ""}`}
                    disabled={busy || ["reserved", "unavailable"].includes(availability)}
                    aria-pressed={selected === s.id}
                    onClick={() => chooseTime(s.id, availability === "event")}
                  >
                    <strong>{time(s.startsAt)}</strong>
                    <span>
                      {availability === "reserved"
                        ? "Reserved"
                        : availability === "unavailable"
                          ? "Unavailable"
                          : `${s.discount}% off`}
                    </span>
                    {availability === "event" && (
                      <small>
                        {remaining > 0
                          ? `EatTogether · ${remaining} seats`
                          : "EatTogether · full"}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
            <section className="slot-events" aria-label="Existing EatTogether Events">
              <h2>EatTogether Events</h2>
              {dayEvents.length ? (
                <ul className="slot-event-list">
                  {dayEvents.map((g) => {
                    const own = g.members.some((p) => p.userId === user.id);
                    const remaining = g.capacity - dinerCount(g);
                    return (
                      <li key={g.id}>
                        <button
                          className={`slot-event-choice ${selected === g.slot.id ? "selected" : ""}`}
                          disabled={busy || !r.active}
                          aria-pressed={selected === g.slot.id}
                          onClick={() => chooseTime(g.slot.id, true)}
                        >
                          <div className="row">
                            <strong>{g.title}</strong>
                            <Status value={eventDisplayStatus(g, now)} />
                          </div>
                          <span>
                            {time(g.slot.startsAt)} · {g.slot.discount}% off · Hosted by{" "}
                            {g.host.name}
                          </span>
                          <span>
                            {dinerCount(g)} / {g.capacity} diners ·{" "}
                            {own
                              ? "You’re joining"
                              : remaining > 0
                                ? `${remaining} seats available`
                                : "Full"}
                          </span>
                          <EventPreferences event={g} />
                          <span className="event-choice-action">
                            {own ? "Select your Event" : "Select Event"} →
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="small muted">No existing Events on this date.</p>
              )}
            </section>
          </>
        ) : (
          <p className="note">No upcoming times available.</p>
        )}
      </section>
      <aside ref={panel} className="panel booking-panel" aria-label="Booking options">
        <h2>Your booking</h2>
        {!slot ? (
          <p className="note" role="status">
            Choose a date and time to see booking options.
          </p>
        ) : (
          <>
            <div className="selection-summary">
              <strong>
                {date(slot.startsAt)} · {time(slot.startsAt)}
              </strong>
              <span>
                {slot.discount}% off · minimum {slot.minimumPartySize} diners
              </span>
            </div>
            <form onSubmit={submit}>
              <label htmlFor="party-size">
                {mode === "group" ? "Your seat" : "Your party size"}
              </label>
              {yourParty ? (
                <output id="party-size" className="party-size-summary">
                  {yourParty.partySize} {yourParty.partySize === 1 ? "diner" : "diners"}
                </output>
              ) : mode === "group" ? (
                <output id="party-size" className="party-size-summary">
                  1 diner
                </output>
              ) : (
                <select
                  id="party-size"
                  value={partySize}
                  disabled={busy || !r.active}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                >
                  {partySize > slot.capacity && (
                    <option value={partySize} disabled>
                      {partySize} diners — exceeds table capacity
                    </option>
                  )}
                  {Array.from({ length: slot.capacity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "diner" : "diners"}
                    </option>
                  ))}
                </select>
              )}
              <div className="mode-tabs" aria-label="Booking type">
                {(
                  [
                    ["booking", "Book"],
                    ["group", "EatTogether"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    aria-pressed={mode === value}
                    className={mode === value ? "selected" : ""}
                    onClick={() => {
                      setMode(value);
                      setCreating(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!r.active || state === "unavailable" || state === "reserved" ? (
                <p className="note" role="status">
                  This time is no longer available. Choose another time.
                </p>
              ) : !validParty ? (
                <p className="note" role="status">
                  Choose a party size between 1 and {slot.capacity} for this table.
                </p>
              ) : mode === "booking" ? (
                <>
                  {state === "event" ? (
                    <>
                      <p className="note">This table is held by an EatTogether Event.</p>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setMode("group")}
                      >
                        View existing Event
                      </button>
                    </>
                  ) : canBook ? (
                    <button disabled={busy}>
                      {busy ? "Booking…" : "Confirm reservation"}
                    </button>
                  ) : (
                    <>
                      <p className="note">
                        This discount requires at least {slot.minimumPartySize} diners.
                        You can join others with EatTogether.
                      </p>
                      <button
                        type="button"
                        className="secondary"
                        disabled={!validParty || busy}
                        onClick={() => setMode("group")}
                      >
                        See EatTogether options
                      </button>
                    </>
                  )}
                </>
              ) : existing ? (
                <div className="event-preview">
                  <div className="row">
                    <h3>{existing.title}</h3>
                    <Status value={eventDisplayStatus(existing, now)} />
                  </div>
                  <p className="small">
                    Hosted by {existing.host.name} · {dinerCount(existing)} /{" "}
                    {existing.capacity} diners
                  </p>
                  {existing.description && (
                    <p className="small">{existing.description}</p>
                  )}
                  <EventPreferences event={existing} />
                  {joinState === "joined" ? (
                    <a className="button" href={`#/groups/${existing.id}`}>
                      Manage your Event
                    </a>
                  ) : joinState === "eligible" && r.active ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(
                          `/groups/${existing.id}/join`,
                          { partySize: 1 },
                          "You have joined the Event.",
                          `/groups/${existing.id}`,
                        )
                      }
                    >
                      {busy ? "Joining…" : "Join Event · 1 diner"}
                    </button>
                  ) : (
                    <p className="note" role="status">
                      {joinState === "direct"
                        ? "Your party meets the minimum for a private reservation. Choose an unreserved time to book."
                        : joinState === "insufficient"
                          ? "There aren’t enough seats for your party. Choose another Event or time."
                          : joinState === "full"
                            ? "This Event is full. Choose another time."
                            : "This Event is closed to new parties."}
                    </p>
                  )}
                  {joinState !== "joined" && (
                    <a className="event-details-link" href={`#/groups/${existing.id}`}>
                      View Event details →
                    </a>
                  )}
                </div>
              ) : state === "event" ? (
                <p className="note" role="status">
                  Event details are refreshing. Please wait before choosing an action.
                </p>
              ) : !user.singpassVerified ? (
                <p className="note" role="status">
                  Singpass verification is required to create or Join EatTogether Events.
                </p>
              ) : !canCreate ? (
                <>
                  <p className="note">
                    Your party meets the {slot.minimumPartySize}-diner minimum. You can
                    book this table directly.
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!validParty || busy}
                    onClick={() => setMode("booking")}
                  >
                    Book a private table
                  </button>
                </>
              ) : creating ? (
                <>
                  <h3 className="create-event-heading">New EatTogether Event</h3>
                  <p className="small">
                    Your table confirms automatically at {slot.minimumPartySize} diners.
                  </p>
                  <label htmlFor="group-title">Event name</label>
                  <input
                    id="group-title"
                    required
                    maxLength={80}
                    placeholder="Event name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <label htmlFor="group-description">
                    Note for other diners <span className="muted">(optional)</span>
                  </label>
                  <textarea
                    id="group-description"
                    maxLength={500}
                    rows={3}
                    placeholder="Add a note"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <details className="event-preferences">
                    <summary>
                      Diner preferences <span className="muted">(optional)</span>
                    </summary>
                    <p className="small muted">
                      Fixed once created. Age is checked at dining time.
                    </p>
                    <fieldset disabled={busy}>
                      <legend className="sr-only">Diner preferences</legend>
                      <label htmlFor="event-gender">Gender</label>
                      <select
                        id="event-gender"
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value as Gender | "")}
                      >
                        <option value="">All genders</option>
                        {user.gender === "FEMALE" ? (
                          <option value="FEMALE">Women only</option>
                        ) : (
                          <option value="MALE">Men only</option>
                        )}
                      </select>
                      <div className="event-age-range">
                        <label htmlFor="event-min-age">
                          Minimum age
                          <input
                            id="event-min-age"
                            type="number"
                            min={18}
                            max={120}
                            step={1}
                            placeholder="18"
                            value={minAge}
                            onChange={(e) => setMinAge(e.target.value)}
                          />
                        </label>
                        <label htmlFor="event-max-age">
                          Maximum age
                          <input
                            id="event-max-age"
                            type="number"
                            min={Number(minAge) || 18}
                            max={120}
                            step={1}
                            placeholder="No limit"
                            value={maxAge}
                            onChange={(e) => setMaxAge(e.target.value)}
                          />
                        </label>
                      </div>
                    </fieldset>
                  </details>
                  <button disabled={busy || !title.trim()}>
                    {busy ? "Creating…" : "Create Event"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setCreating(false)}
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <p className="small">
                    No Event at this time. Start one for your seat, or choose an existing
                    Event at another time.
                  </p>
                  <p className="small muted">
                    Friends Join separately with their own accounts.
                  </p>
                  <button type="button" disabled={busy} onClick={() => setCreating(true)}>
                    Start an EatTogether Event
                  </button>
                </>
              )}
            </form>
          </>
        )}
      </aside>
    </div>
  );
}
