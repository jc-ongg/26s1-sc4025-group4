import { useState } from "react";
import type { Group, Booking } from "./types";
import {
  Art,
  Empty,
  State,
  Status,
  date,
  time,
  useResource,
  type Actions,
} from "./dining-ui";

const PAGE_SIZE = 3;

function ListPages({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="list-pagination">
      <span>
        {total} {total === 1 ? "plan" : "plans"} · Page {page + 1} of {pages}
      </span>
      <div>
        <button
          className="text-button"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          ←
        </button>
        <button
          className="text-button"
          aria-label="Next page"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
}
export function Bookings({ revision, act, busy }: Actions) {
  const { data, error } = useResource<{ bookings: Booking[] }>("/me/bookings", revision);
  const parties = useResource<{ groups: Group[] }>("/me/groups", revision);
  const [partyPage, setPartyPage] = useState(0),
    [bookingPage, setBookingPage] = useState(0),
    [filter, setFilter] = useState("all"),
    [cancelId, setCancelId] = useState<string | null>(null);
  // Use one instant for both lists so a starting reservation cannot appear in inconsistent filters.
  const now = Date.now();
  const groups = (parties.data?.groups ?? []).filter(
    (g) =>
      filter === "all" ||
      (filter === "upcoming"
        ? ["OPEN", "FULL", "CONFIRMED"].includes(g.status) &&
          new Date(g.slot.startsAt).getTime() > now
        : g.status === "CANCELLED" ||
          g.status === "EXPIRED" ||
          new Date(g.slot.startsAt).getTime() <= now),
  );
  const bookings = (data?.bookings ?? []).filter(
    (b) =>
      filter === "all" ||
      (filter === "upcoming"
        ? b.status === "CONFIRMED" && new Date(b.slot.startsAt).getTime() > now
        : b.status === "CANCELLED" || new Date(b.slot.startsAt).getTime() <= now),
  );
  // Deletion or live updates can shrink either list while a later page is selected.
  const groupPage = Math.min(
      partyPage,
      Math.max(0, Math.ceil(groups.length / PAGE_SIZE) - 1),
    ),
    reservationPage = Math.min(
      bookingPage,
      Math.max(0, Math.ceil(bookings.length / PAGE_SIZE) - 1),
    );
  return (
    <>
      <section className="page-intro plans-intro">
        <div>
          <p className="eyebrow">YOUR PEOPLE. YOUR PLANS.</p>
          <h1>My bookings</h1>
          <p>Every party and reservation, in one place.</p>
        </div>
        <div className="mode-tabs" aria-label="Booking filters">
          {[
            ["all", "All plans"],
            ["upcoming", "Upcoming"],
            ["history", "History"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "selected" : ""}
              onClick={() => {
                setFilter(value);
                setPartyPage(0);
                setBookingPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="my-plans-layout compact-plans">
        <section aria-label="My parties">
          <div className="section-heading">
            <h2>
              My parties <span className="count-badge">{groups.length}</span>
            </h2>
            <a className="text-button" href="#/groups">
              Find a party ↗
            </a>
          </div>
          <p className="small muted">The people you’re dining with.</p>
          <State data={parties.data} error={parties.error}>
            <ul className="plan-list">
              {groups
                .slice(groupPage * PAGE_SIZE, (groupPage + 1) * PAGE_SIZE)
                .map((g) => (
                  <li key={g.id} className="plan-row">
                    <Art restaurant={g.slot.restaurant} />
                    <div className="plan-content">
                      <div className="row">
                        <span className="small muted">Eatogether</span>
                        <Status value={g.status} />
                      </div>
                      <a className="plan-title" href={`#/groups/${g.id}`} title={g.title}>
                        {g.title}
                      </a>
                      <p className="plan-venue" title={g.slot.restaurant.name}>
                        {g.slot.restaurant.name}
                      </p>
                      <p className="small">
                        {date(g.slot.startsAt)} · {time(g.slot.startsAt)}
                      </p>
                      <div className="row small">
                        <span>
                          {g.members.length}/{g.capacity} diners · {g.slot.discount}% off
                        </span>
                        <a href={`#/groups/${g.id}`}>View party →</a>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            {!groups.length && (
              <Empty
                title="No parties here yet"
                text="Find an Eatogether party or try another filter."
              />
            )}
            <ListPages page={groupPage} total={groups.length} onChange={setPartyPage} />
          </State>
        </section>
        <section aria-label="My reservations">
          <div className="section-heading">
            <h2>
              My reservations <span className="count-badge">{bookings.length}</span>
            </h2>
            <a className="text-button" href="#/restaurants">
              Book a meal ↗
            </a>
          </div>
          <p className="small muted">Your restaurant confirmations and history.</p>
          <State data={data} error={error}>
            <ul className="plan-list">
              {bookings
                .slice(reservationPage * PAGE_SIZE, (reservationPage + 1) * PAGE_SIZE)
                .map((b) => (
                  <li className="plan-row" key={b.id}>
                    <Art restaurant={b.slot.restaurant} />
                    <div className="plan-content">
                      <div className="row">
                        <span className="small muted">
                          {b.group ? "Eatogether" : "Reservation"}
                        </span>
                        <Status value={b.status} />
                      </div>
                      <h3 className="plan-title" title={b.slot.restaurant.name}>
                        {b.slot.restaurant.name}
                      </h3>
                      <p className="small">
                        {date(b.slot.startsAt)} · {time(b.slot.startsAt)}
                      </p>
                      <p className="small muted">
                        {b.partySize} diners · {b.slot.discount}% off · #
                        {b.id.slice(0, 8).toUpperCase()}
                      </p>
                      <div className="plan-actions">
                        {b.group && <a href={`#/groups/${b.group.id}`}>View party →</a>}
                        {b.status === "CANCELLED" ? (
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() =>
                              act(
                                `/bookings/${b.id}/delete`,
                                {},
                                "Cancelled booking deleted from your history.",
                              )
                            }
                          >
                            Delete
                          </button>
                        ) : (
                          !b.group &&
                          new Date(b.slot.startsAt).getTime() > now &&
                          (cancelId === b.id ? (
                            <>
                              <button
                                className="text-button danger-text"
                                disabled={busy}
                                onClick={() =>
                                  act(
                                    `/bookings/${b.id}/cancel`,
                                    {},
                                    "Booking cancelled.",
                                  )
                                }
                              >
                                Confirm cancellation
                              </button>
                              <button
                                className="text-button"
                                onClick={() => setCancelId(null)}
                              >
                                Keep
                              </button>
                            </>
                          ) : (
                            <button
                              className="text-button danger-text"
                              onClick={() => setCancelId(b.id)}
                            >
                              Cancel booking
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            {!bookings.length && (
              <Empty
                title="No reservations here yet"
                text="Book a meal or confirm your Eatogether party."
              />
            )}
            <ListPages
              page={reservationPage}
              total={bookings.length}
              onChange={setBookingPage}
            />
          </State>
        </section>
      </div>
    </>
  );
}
