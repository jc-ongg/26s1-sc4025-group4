import { useState } from "react";
import type { Group, User } from "./types";
import { EventUpdates } from "./EventUpdates";
import { reservationProgress } from "./event-feedback";
import { eventDisplayStatus } from "./booking-history";
import { eventJoinState } from "./booking-flow";
import { currentGroupStatus, hasStarted, dinerCount, canJoinEvent } from "./availability";
import {
  Art,
  Empty,
  GroupCard,
  State,
  Status,
  date,
  time,
  useResource,
  type Actions,
} from "./dining-ui";

export function Groups({
  revision,
  mine = false,
  embedded = false,
}: Actions & { mine?: boolean; embedded?: boolean }) {
  const { data, error } = useResource<{ groups: Group[] }>(
    mine ? "/me/groups" : "/groups",
    revision,
  );
  const [page, setPage] = useState(0);
  const groups = data?.groups.filter((g) => mine || canJoinEvent(g));
  const pageSize = 6;
  const pages = Math.max(1, Math.ceil((groups?.length ?? 0) / pageSize));
  const currentPage = Math.min(page, pages - 1);
  return (
    <>
      {!embedded && (
        <section className="page-intro">
          <h1>{mine ? "My Events" : "EatTogether"}</h1>
        </section>
      )}
      <div className="section-heading">
        <h3>{mine ? "Your Events" : "Available Events"}</h3>
        <span className="small muted">{groups?.length ?? 0} Events</span>
      </div>
      <State data={data} error={error}>
        <div className="grid party-results">
          {groups
            ?.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
            .map((g) => (
              <GroupCard group={g} key={g.id} />
            ))}
        </div>
        {groups?.length === 0 && (
          <Empty
            title="No Events found"
            text="Explore restaurants and start a table of your own."
          />
        )}
        {pages > 1 && (
          <div className="list-pagination">
            <span>
              Page {currentPage + 1} of {pages}
            </span>
            <div>
              <button
                className="text-button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <button
                className="text-button"
                disabled={currentPage + 1 === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </State>
    </>
  );
}

export function GroupDetail({
  id,
  user,
  revision,
  busy,
  act,
}: Actions & { id: string; user: User }) {
  const { data, error } = useResource<{ group: Group }>(
    `/groups/${encodeURIComponent(id)}`,
    revision,
  );
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [joiningSize, setJoiningSize] = useState(1);
  const [editedSize, setEditedSize] = useState<number | null>(null);
  const g = data?.group,
    host = g?.hostId === user.id,
    party = g?.members.find((m) => m.userId === user.id);
  const status = g && currentGroupStatus(g);
  const mutable =
    !!g &&
    ["OPEN", "FULL", "CONFIRMED"].includes(status!) &&
    !hasStarted(g.slot.startsAt);
  const count = g ? dinerCount(g) : 0;
  const remaining = g ? g.capacity - count : 0;
  const joinLimit = g ? Math.min(remaining, g.slot.minimumPartySize - 1) : 0;
  const partySize = editedSize ?? party?.partySize ?? 1;
  const partyLimit = remaining + (party?.partySize ?? 0);
  const joiningPartySize = Math.min(joiningSize, Math.max(1, joinLimit));
  const joinState = g && eventJoinState(g, joiningPartySize, user.id);
  const perform = (action: string, message: string, body = {}) =>
    act(`/groups/${id}/${action}`, body, message);
  return (
    <>
      <EventUpdates group={g} userId={user.id} />
      <a
        className="back"
        href={g ? `#/restaurants/${g.slot.restaurant.id}` : "#/restaurants"}
      >
        ← Back to restaurant
      </a>
      <State data={data} error={error}>
        {g && (
          <>
            <div className="group-top">
              <div>
                <h1>{g.title}</h1>
                <div className="row start">
                  <Status value={eventDisplayStatus(g)} />
                  <span className="small muted">Hosted by {g.host.name}</span>
                </div>
              </div>
              <span className="big-discount">
                {g.slot.discount}%<small>off your meal</small>
              </span>
            </div>
            <div className="detail-layout">
              <section>
                <div className="group-restaurant">
                  <Art restaurant={g.slot.restaurant} />
                  <div>
                    <h2>{g.slot.restaurant.name}</h2>
                    <p>
                      {g.slot.restaurant.cuisine} · {g.slot.restaurant.area}
                    </p>
                    <a href={`#/restaurants/${g.slot.restaurant.id}`}>
                      View restaurant →
                    </a>
                  </div>
                </div>
                <div className="info-grid">
                  <div>
                    <span className="eyebrow">WHEN</span>
                    <strong>{date(g.slot.startsAt)}</strong>
                    <span>{time(g.slot.startsAt)} · Singapore time</span>
                  </div>
                  <div>
                    <span className="eyebrow">THE TABLE</span>
                    <strong>
                      {count} of {g.capacity} seats filled
                    </strong>
                    <span>Minimum {g.slot.minimumPartySize} diners for the discount</span>
                  </div>
                </div>
                {g.description && (
                  <>
                    <h2>Host's note</h2>
                    <p className="group-note">{g.description}</p>
                  </>
                )}
                <div className="section-heading">
                  <h2>Who’s joining</h2>
                  <span className="muted small">{count} diners</span>
                </div>
                <div className="participants">
                  {g.members.map((m) => (
                    <div className="participant" key={m.userId}>
                      <span className="avatar">{m.user.name[0]}</span>
                      <strong>
                        {m.user.name}
                        {m.userId === user.id ? " (you)" : ""}
                      </strong>
                      <span className="small muted">
                        {m.userId === g.hostId ? "Host" : "Joining Party"} · {m.partySize}{" "}
                        {m.partySize === 1 ? "diner" : "diners"}
                      </span>
                    </div>
                  ))}
                  {mutable &&
                    Array.from({ length: g.capacity - count }, (_, i) => (
                      <div className="participant vacant" key={i}>
                        <span className="avatar">+</span>
                        <span>Open seat</span>
                      </div>
                    ))}
                </div>
              </section>
              <aside className="panel action-panel">
                <h2>
                  {mutable ? (party ? "Your Party" : "Join Event") : "Event details"}
                </h2>
                <p>
                  {mutable
                    ? `${reservationProgress(g)} ${status === "CONFIRMED" ? "Parties can Join or Leave until dining time." : "Confirmation is automatic when the minimum is met."}`
                    : "This Event is closed to changes."}
                </p>
                <p className="small">
                  {count} / {g.capacity} diners
                  {mutable && ` · ${remaining} seats remaining`}
                </p>
                {g.booking && party && (
                  <p className="small booking-reference">
                    Reservation #{g.booking.id.slice(0, 8).toUpperCase()}
                  </p>
                )}
                {mutable &&
                  (party ? (
                    <>
                      {host && (
                        <p className="note small">
                          You are the Host. If you Leave, the earliest Joining Party
                          becomes the Host. An empty Event is cancelled.
                        </p>
                      )}
                      <label htmlFor="event-party-size">Your Party size</label>
                      <select
                        id="event-party-size"
                        disabled={busy || !g.slot.restaurant.active}
                        value={partySize}
                        onChange={(e) => setEditedSize(Number(e.target.value))}
                      >
                        {partySize > partyLimit && (
                          <option value={partySize} disabled>
                            {partySize} diners — no longer available
                          </option>
                        )}
                        {Array.from({ length: partyLimit }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? "diner" : "diners"}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={
                          busy ||
                          !g.slot.restaurant.active ||
                          partySize === party.partySize ||
                          partySize > partyLimit
                        }
                        onClick={async () => {
                          if (
                            await perform("resize", "Your Party size has been updated.", {
                              partySize,
                            })
                          )
                            setEditedSize(null);
                        }}
                      >
                        Update Party
                      </button>
                      {leavePrompt ? (
                        <div className="cancel-prompt">
                          <p>
                            {host
                              ? "Leave your Event? The next party becomes the host. An empty Event is cancelled."
                              : "Remove your party from this Event?"}
                          </p>
                          <p className="small">
                            The reservation returns to waiting if the remaining diners
                            fall below the minimum.
                          </p>
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await perform("leave", "Your party has left the Event.")
                              )
                                setLeavePrompt(false);
                            }}
                          >
                            Confirm leave
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setLeavePrompt(false)}
                          >
                            Stay in Event
                          </button>
                        </div>
                      ) : (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => {
                            setLeavePrompt(true);
                            setCancelPrompt(false);
                          }}
                        >
                          Leave Event
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {joinLimit > 0 && (
                        <>
                          <label htmlFor="joining-party-size">Your Party size</label>
                          <select
                            id="joining-party-size"
                            disabled={busy}
                            value={joiningPartySize}
                            onChange={(e) => setJoiningSize(Number(e.target.value))}
                          >
                            {Array.from({ length: joinLimit }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n} {n === 1 ? "diner" : "diners"}
                                </option>
                              ),
                            )}
                          </select>
                        </>
                      )}
                      <button
                        disabled={
                          busy || joinState !== "eligible" || !g.slot.restaurant.active
                        }
                        onClick={() =>
                          perform("join", "Your Party has joined the Event.", {
                            partySize: joiningPartySize,
                          })
                        }
                      >
                        {remaining ? "Join Event" : "Event full"}
                      </button>
                    </>
                  ))}
                {g.booking?.status === "CONFIRMED" && party && (
                  <a className="button dark" href="#/bookings">
                    View my bookings →
                  </a>
                )}
                {mutable &&
                  host &&
                  (cancelPrompt ? (
                    <div className="cancel-prompt">
                      <p>Cancel this Event for every Party and release its table?</p>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await perform(
                              "cancel",
                              "Event cancelled. The table is available again.",
                            )
                          )
                            setCancelPrompt(false);
                        }}
                      >
                        Yes, cancel Event
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setCancelPrompt(false)}
                      >
                        Keep Event
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => {
                        setCancelPrompt(true);
                        setLeavePrompt(false);
                      }}
                    >
                      Cancel Event for everyone
                    </button>
                  ))}
              </aside>
            </div>
          </>
        )}
      </State>
    </>
  );
}
