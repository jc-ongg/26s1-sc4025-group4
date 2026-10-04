import { useState } from "react";
import type { Group, PersonalBooking, User } from "./types";
import { currentGroupStatus, dinerCount } from "./availability";
import {
  matchesBooking,
  matchesEvent,
  byDiningTime,
  bookingDisplayStatus,
  eventDisplayStatus,
  type BookingFilter,
} from "./booking-history";
import { reservationProgress } from "./event-feedback";
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

function PartyCounts({
  yourSize,
  total,
  capacity,
}: {
  yourSize: number | null;
  total: number;
  capacity?: number;
}) {
  return (
    <p className="plan-diners">
      {yourSize !== null && <>Your Party: {yourSize} · </>}
      Event total: {total}
      {capacity ? `/${capacity}` : ""} diners
    </p>
  );
}

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
  const noun = label === "Reservations" ? "reservation" : "Event";
  return (
    <div className="list-pagination">
      <span>
        {`${total} ${noun}${total === 1 ? "" : "s"}`} · Page {page + 1} of {pages}
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
export function Bookings({ revision, act, busy, user }: Actions & { user: User }) {
  const { data, error } = useResource<{ bookings: PersonalBooking[] }>(
    "/me/bookings",
    revision,
  );
  const parties = useResource<{ groups: Group[] }>("/me/groups", revision);
  const [partyPage, setPartyPage] = useState(0),
    [bookingPage, setBookingPage] = useState(0),
    [filter, setFilter] = useState<BookingFilter>("all"),
    [cancelId, setCancelId] = useState<string | null>(null);
  // Use one instant for both lists so a starting reservation cannot appear in inconsistent filters.
  const now = Date.now();
  const groups = (parties.data?.groups ?? [])
    .filter((g) => matchesEvent(g, filter, now))
    .sort(byDiningTime(filter));
  const bookings = (data?.bookings ?? [])
    .filter((b) => !b.group && matchesBooking(b, filter, now))
    .sort(byDiningTime(filter));
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
                setFilter(value as BookingFilter);
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
                  <li
                    className="plan-row"
                    data-status={bookingDisplayStatus(b, now).toLowerCase()}
                    key={b.id}
                  >
                    <Art restaurant={b.slot.restaurant} />
                    <div className="plan-content">
                      <div className="row">
                        <span className="small muted">Private reservation</span>
                        <Status value={bookingDisplayStatus(b, now)} />
                      </div>
                      <h3 className="plan-title" title={b.slot.restaurant.name}>
                        {b.slot.restaurant.name}
                      </h3>
                      <p className="small">
                        {date(b.slot.startsAt)} · {time(b.slot.startsAt)}
                      </p>
                      <p className="plan-diners">
                        {b.partySize} {b.partySize === 1 ? "diner" : "diners"}
                      </p>
                      <p className="small muted">
                        {b.slot.discount}% off · #{b.id.slice(0, 8).toUpperCase()}
                      </p>
                      <div className="plan-actions">
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
                title={
                  filter === "upcoming"
                    ? "No upcoming reservations"
                    : filter === "history"
                      ? "No reservation history"
                      : "No reservations here yet"
                }
                text={
                  filter === "upcoming"
                    ? "Confirmed future reservations appear here."
                    : "Your private reservations appear here."
                }
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
        <section aria-label="EatTogether">
          <div className="section-heading">
            <h2>
              EatTogether Events <span className="count-badge">{groups.length}</span>
            </h2>
          </div>
          <State data={parties.data} error={parties.error}>
            <ul className="plan-list">
              {groups
                .slice(groupPage * PAGE_SIZE, (groupPage + 1) * PAGE_SIZE)
                .map((g) => (
                  <li
                    key={g.id}
                    className="plan-row"
                    data-status={eventDisplayStatus(g, now).toLowerCase()}
                  >
                    <Art restaurant={g.slot.restaurant} />
                    <div className="plan-content">
                      <div className="row">
                        <span className="small muted">EatTogether</span>
                        <Status value={eventDisplayStatus(g, now)} />
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
                      <PartyCounts
                        yourSize={
                          g.members.find((party) => party.userId === user.id)
                            ?.partySize ?? null
                        }
                        total={dinerCount(g)}
                        capacity={g.capacity}
                      />
                      {["OPEN", "FULL"].includes(currentGroupStatus(g, now)) && (
                        <p className="plan-pending">{reservationProgress(g, now)}</p>
                      )}
                      <div className="row small event-booking-actions">
                        <span>
                          {g.slot.discount}% off
                          {g.booking &&
                            g.booking.status !== "PENDING" &&
                            ` · #${g.booking.id.slice(0, 8).toUpperCase()}`}
                        </span>
                        <a href={`#/groups/${g.id}`}>View Event →</a>
                        {g.booking?.status === "CANCELLED" && (
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() =>
                              act(
                                `/bookings/${g.booking!.id}/delete`,
                                {},
                                "Cancelled booking deleted from your history.",
                              )
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            {!groups.length && (
              <Empty
                title={
                  filter === "upcoming"
                    ? "No upcoming Events"
                    : filter === "history"
                      ? "No Event history"
                      : "No Events here yet"
                }
                text={
                  filter === "upcoming"
                    ? "Future Events you belong to appear here, including those waiting for diners."
                    : "Your EatTogether Events appear here."
                }
              />
            )}
            <ListPages
              label="EatTogether"
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
