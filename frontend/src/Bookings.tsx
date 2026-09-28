import { useState } from "react";
import type { Group, Booking } from "./types";
import { currentGroupStatus } from "./availability";
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

const PAGE_SIZE = 2;

function ListPages({
  page,
  total,
  onChange,
  label,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="list-pagination">
      <span>
        {total} {total === 1 ? "plan" : "plans"} · Page {page + 1} of {pages}
      </span>
      {pages > 1 && (
        <div>
          <button
            className="text-button"
            aria-label={`Previous ${label.toLowerCase()} page`}
            disabled={page === 0}
            onClick={() => onChange(page - 1)}
          >
            Previous
          </button>
          <button
            className="text-button"
            aria-label={`Next ${label.toLowerCase()} page`}
            disabled={page + 1 >= pages}
            onClick={() => onChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
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
          <h1>My bookings</h1>
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
        <section aria-label="Reservations">
          <div className="section-heading">
            <h2>
              Reservations <span className="count-badge">{bookings.length}</span>
            </h2>
          </div>
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
              label="Reservations"
              page={reservationPage}
              total={bookings.length}
              onChange={setBookingPage}
            />
          </State>
        </section>
        <section aria-label="Eatogether">
          <div className="section-heading">
            <h2>
              Eatogether <span className="count-badge">{groups.length}</span>
            </h2>
          </div>
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
                        <Status value={currentGroupStatus(g, now)} />
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
            <ListPages
              label="Eatogether"
              page={groupPage}
              total={groups.length}
              onChange={setPartyPage}
            />
          </State>
        </section>
      </div>
    </>
  );
}
