import { useState } from "react";
import type { Group, User } from "./types";
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

export function Groups({ revision, mine = false }: Actions & { mine?: boolean }) {
  const { data, error } = useResource<{ groups: Group[] }>(
    mine ? "/me/groups" : "/groups",
    revision,
  );
  const [availableOnly, setAvailableOnly] = useState(false);
  const groups = data?.groups.filter((g) => !availableOnly || canJoinEvent(g));
  return (
    <>
      <section className="page-intro">
        <h1>{mine ? "My Events" : "EatTogether"}</h1>
      </section>
      <div className="section-heading">
        <h2>{mine ? "Your Events" : "Available Events"}</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Seats available only
        </label>
      </div>
      <State data={data} error={error}>
        <div className="grid party-results">
          {groups?.map((g) => (
            <GroupCard group={g} key={g.id} />
          ))}
        </div>
        {groups?.length === 0 && (
          <Empty
            title="No Events found"
            text="Explore restaurants and start a table of your own."
          />
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
  const perform = (action: string, message: string, body = {}) =>
    act(`/groups/${id}/${action}`, body, message);
  return (
    <>
      <a className="back" href="#/groups">
        ← EatTogether Events
      </a>
      <State data={data} error={error}>
        {g && (
          <>
            <div className="group-top">
              <div>
                <h1>{g.title}</h1>
                <div className="row start">
                  <Status value={status!} />
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
                  {!mutable
                    ? "This Event is closed to changes."
                    : status === "CONFIRMED"
                      ? `The minimum is met. Parties can still Join or Leave before the dining time. If the diner count drops below ${g.slot.minimumPartySize}, the Event becomes Undersubscribed.`
                      : `${g.slot.minimumPartySize - count} more diner(s) needed. Confirmation is automatic when the minimum is met.`}
                </p>
                <p className="small">
                  {count} / {g.capacity} diners · {remaining} seats remaining
                </p>
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
                        disabled={busy}
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
                          busy || partySize === party.partySize || partySize > partyLimit
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
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => perform("leave", "Your Party has left the Event.")}
                      >
                        Leave Event
                      </button>
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
                        disabled={busy || joinLimit === 0}
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
                      onClick={() => setCancelPrompt(true)}
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
