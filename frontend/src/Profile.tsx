import { useState } from "react";
import type { PersonalBooking, User } from "./types";
import { isPastBooking, isUpcomingBooking, byDiningTime } from "./booking-history";
import { Art, State, Status, date, time, useResource, Empty } from "./dining-ui";

export function Profile({ user, revision }: { user: User; revision: number }) {
  const resource = useResource<{ bookings: PersonalBooking[] }>("/me/bookings", revision);
  const reliability = useResource<{ profile: User & { reliabilityStrikes: number } }>(
    "/me/profile",
    revision,
  );
  const now = Date.now();
  const bookings = resource.data?.bookings ?? [];
  const past = bookings
    .filter((b) => isPastBooking(b, now))
    .sort(byDiningTime("history"));
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(past.length / 2) - 1));
  return (
    <>
      <section className="page-intro">
        <h1>Profile</h1>
      </section>
      <div className="profile-layout">
        <aside className="panel profile-identity">
          <span className="avatar profile-avatar" aria-hidden="true">
            {user.name[0]}
          </span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          {user.singpassVerified && (
            <span className="profile-verification">
              <span aria-hidden="true">✓</span> Singpass verified
            </span>
          )}
          {user.ageBand && (
            <p className="small muted profile-demographics">
              Age {user.ageBand}
              {user.gender && ` · ${user.gender === "FEMALE" ? "Female" : "Male"}`}
            </p>
          )}
          <dl>
            <div>
              <dt>Upcoming reservations</dt>
              <dd>
                {resource.data
                  ? bookings.filter((b) => isUpcomingBooking(b, now)).length
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Past bookings</dt>
              <dd>{resource.data ? past.length : "—"}</dd>
            </div>
          </dl>
          <div className="profile-reliability">
            <h3>
              Reliability Score <span className="badge">Private</span>
            </h3>
            <State data={reliability.data} error={reliability.error}>
              <p className="reliability-count">
                {reliability.data?.profile.reliabilityStrikes}{" "}
                <span>recorded strikes</span>
              </p>
            </State>
          </div>
        </aside>
        <section className="panel profile-history" aria-label="Past bookings">
          <h2>Past bookings</h2>
          <State data={resource.data} error={resource.error}>
            {past.length ? (
              <>
                <ul className="plan-list">
                  {past.slice(current * 2, current * 2 + 2).map((booking) => (
                    <li className="plan-row" data-status="past" key={booking.id}>
                      <Art restaurant={booking.slot.restaurant} />
                      <div className="plan-content">
                        <div className="row">
                          <span className="small muted">
                            {booking.group ? "EatTogether" : "Reservation"}
                          </span>
                          <Status value="PAST" />
                        </div>
                        <h3>{booking.slot.restaurant.name}</h3>
                        <p className="small">
                          {date(booking.slot.startsAt)} · {time(booking.slot.startsAt)}
                        </p>
                        <p className="small">
                          {booking.group ? (
                            <>
                              {booking.yourPartySize !== null && (
                                <>Your Party: {booking.yourPartySize} · </>
                              )}
                              Event total:{" "}
                            </>
                          ) : null}
                          {booking.partySize} diners
                        </p>
                        <p className="small">{booking.slot.discount}% off</p>
                        <p className="small muted">
                          #{booking.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="list-pagination">
                  <span>
                    {past.length} bookings · Page {current + 1} of{" "}
                    {Math.ceil(past.length / 2)}
                  </span>
                  {past.length > 2 && (
                    <div>
                      <button
                        className="text-button"
                        disabled={current === 0}
                        onClick={() => setPage(current - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="text-button"
                        disabled={(current + 1) * 2 >= past.length}
                        onClick={() => setPage(current + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Empty
                title="No past bookings"
                text="Your past confirmed reservations appear here."
              />
            )}
          </State>
        </section>
      </div>
    </>
  );
}
