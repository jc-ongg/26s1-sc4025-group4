import { useState } from "react";
import type { Group, User } from "./types";
import { EventUpdates } from "./EventUpdates";
import { reservationProgress } from "./event-feedback";
import { eventDisplayStatus } from "./booking-history";
import { eventJoinState } from "./booking-flow";
import { currentGroupStatus, hasStarted, dinerCount } from "./availability";
import { EventSocial, DinerSafety } from "./EventSocial";
import { EventPreferences } from "./EventPreferences";
import { InfoTip } from "./InfoTip";
import { Art, State, Status, date, time, useResource, type Actions } from "./dining-ui";

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
  const g = data?.group,
    host = g?.hostId === user.id,
    party = g?.members.find((m) => m.userId === user.id);
  const status = g && currentGroupStatus(g);
  const mutable =
    !!g &&
    ["OPEN", "FULL", "CONFIRMED", "LAST_CALL", "PRICE_DECISION", "FULL_PRICE"].includes(
      status!,
    ) &&
    !hasStarted(g.slot.startsAt);
  const count = g ? dinerCount(g) : 0;
  const remaining = g ? g.capacity - count : 0;
  const joinState = g && eventJoinState(g, 1, user.id);
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
                  <Status
                    value={hasStarted(g.slot.startsAt) ? eventDisplayStatus(g) : status!}
                  />
                  <span className="small muted">Hosted by {g.host.name}</span>
                </div>
              </div>
              <span className="big-discount">
                {g.discount === 0 ? "Full price" : `${g.discount ?? g.slot.discount}%`}
                <small>{g.discount === 0 ? "No discount" : "off your meal"}</small>
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
                    <span className="row start">
                      <span className="eyebrow">EVENT CAPACITY</span>
                      {mutable && (
                        <InfoTip label="About Held Seats and Event Capacity">
                          {g.heldSeats ?? count} seats are held for this Event. Further
                          Joins share the restaurant’s remaining seats, up to its table
                          limit. The discount is confirmed automatically at{" "}
                          {g.slot.minimumPartySize} diners.
                        </InfoTip>
                      )}
                    </span>
                    <strong>
                      {count} of {g.capacity} seats taken
                    </strong>
                    <span>Minimum Party Size: {g.slot.minimumPartySize} diners</span>
                  </div>
                </div>
                <EventPreferences event={g} />
                {g.cutoffAt && mutable && (
                  <p className="small muted">
                    Cutoff: {date(g.cutoffAt)} · {time(g.cutoffAt)}{" "}
                    <InfoTip label="About Cutoff">
                      Two hours before dining. If the minimum is not met, choose full
                      price or decline without a penalty. A confirmed Event that drops
                      below the minimum afterwards opens Last Call for replacement diners.
                    </InfoTip>
                  </p>
                )}
                {g.description && (
                  <>
                    <h2>Host's note</h2>
                    <p className="group-note">{g.description}</p>
                  </>
                )}
                <div className="section-heading">
                  <h2>Who’s joining</h2>
                  <span className="muted small">
                    {count} {count === 1 ? "diner" : "diners"}
                  </span>
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
                        {m.userId === g.hostId ? "Host" : "Diner"}
                        {m.user.age != null && ` · Age ${m.user.age}`}
                        {m.user.gender &&
                          ` · ${m.user.gender === "MALE" ? "Male" : "Female"}`}
                      </span>
                      {party && m.userId !== user.id && (
                        <DinerSafety
                          group={g}
                          target={m.user}
                          revision={revision}
                          act={act}
                          busy={busy}
                        />
                      )}
                    </div>
                  ))}
                  {mutable &&
                    ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"].includes(status!) &&
                    Array.from({ length: Math.max(0, g.capacity - count) }, (_, i) => (
                      <div className="participant vacant" key={i}>
                        <span className="avatar">+</span>
                        <span>Open seat</span>
                      </div>
                    ))}
                </div>
                <EventSocial
                  group={g}
                  user={user}
                  revision={revision}
                  act={act}
                  busy={busy}
                />
              </section>
              <aside className="panel action-panel">
                <h2>
                  {mutable ? (party ? "Your seat" : "Join Event") : "Event details"}
                </h2>
                <p>
                  {mutable ? reservationProgress(g) : "This Event is closed to changes."}
                </p>
                <p className="small">
                  {count} / {g.capacity} diners
                  {mutable &&
                    ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"].includes(status!) &&
                    ` · ${remaining} seats remaining`}
                </p>
                {g.booking && party && (
                  <p className="small booking-reference">
                    Reservation #{g.booking.id.slice(0, 8).toUpperCase()}
                  </p>
                )}
                {mutable && party && status === "PRICE_DECISION" && (
                  <div className="price-choice">
                    <p className="note">
                      The minimum was not reached by Cutoff. The discount is withdrawn.
                    </p>
                    {party.priceAccepted ? (
                      <p className="small">
                        You accepted full price. Waiting for the other diners’ choices.
                      </p>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(
                            "accept-price",
                            "You accepted a full-price reservation.",
                          )
                        }
                      >
                        Accept full price
                      </button>
                    )}
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        perform(
                          "decline-price",
                          "You declined the booking without a penalty.",
                        )
                      }
                    >
                      Decline without penalty
                    </button>
                  </div>
                )}
                {mutable &&
                  status !== "PRICE_DECISION" &&
                  (party ? (
                    <>
                      {host && (
                        <p className="note small">
                          You are the Host. If you Leave, the earliest Joining Party
                          becomes the Host. An empty Event is cancelled.
                        </p>
                      )}
                      <p className="party-size-summary">
                        {party.partySize}{" "}
                        {party.partySize === 1 ? "seat reserved" : "seats reserved"}
                      </p>
                      {party.partySize > 1 && (
                        <>
                          <p className="small">
                            Each diner now Joins with their own account. Your existing
                            reservation is unchanged until you update it.
                          </p>
                          <button
                            className="secondary"
                            disabled={busy || !g.slot.restaurant.active}
                            onClick={() =>
                              (!g.leavePenalty ||
                                window.confirm(
                                  "Reducing your reservation after Cutoff records a reliability strike. Continue?",
                                )) &&
                              perform("resize", "Your reservation now holds one seat.", {
                                partySize: 1,
                                acknowledgeStrike: g.leavePenalty === true,
                              })
                            }
                          >
                            Keep only my seat
                          </button>
                        </>
                      )}
                      {leavePrompt ? (
                        <div className="cancel-prompt">
                          <p>
                            {host
                              ? "Leave your Event? The next party becomes the host. An empty Event is cancelled."
                              : party.partySize === 1
                                ? "Leave this Event and release your seat?"
                                : `Leave this Event and release your ${party.partySize} seats?`}
                          </p>
                          <p className="small">
                            {g.leavePenalty
                              ? "This Leave records a reliability strike. Three strikes within 90 days suspend EatTogether for one week. Ordinary bookings are unaffected."
                              : status === "LAST_CALL" || status === "FULL_PRICE"
                                ? "You can Leave without a reliability strike."
                                : "The reservation returns to waiting if the remaining diners fall below the minimum."}
                          </p>
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await perform("leave", "You have left the Event.", {
                                  acknowledgeStrike: g.leavePenalty === true,
                                })
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
                      <p className="small">
                        One seat per account. Friends Join separately with their own
                        accounts.
                      </p>
                      <button
                        disabled={
                          busy || joinState !== "eligible" || !g.slot.restaurant.active
                        }
                        onClick={() =>
                          perform("join", "You have joined the Event.", {
                            partySize: 1,
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
                      <p>Cancel this Event for every Party and release its seats?</p>
                      {g.leavePenalty && (
                        <p className="small">
                          This late cancellation records a reliability strike for you.
                          Other diners receive no strike.
                        </p>
                      )}
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await perform(
                              "cancel",
                              "Event cancelled. The seats are available again.",
                              { acknowledgeStrike: g.leavePenalty === true },
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
