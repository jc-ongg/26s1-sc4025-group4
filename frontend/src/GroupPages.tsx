import { useState } from "react";
import type { Group, User } from "./types";
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
  const groups = data?.groups.filter((g) => !availableOnly || g.status === "OPEN");
  return (
    <>
      <section className="page-intro">
        <h1>{mine ? "My parties" : "Eatogether"}</h1>
      </section>
      <div className="section-heading">
        <h2>{mine ? "Your parties" : "Available parties"}</h2>
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
            title="No parties found"
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
  const g = data?.group,
    host = g?.hostId === user.id,
    member = g?.members.some((m) => m.userId === user.id);
  const pending = g?.status === "OPEN" || g?.status === "FULL";
  const canConfirm = !!g && pending && g.members.length >= g.slot.minimumPartySize;
  const perform = (action: string, message: string) =>
    act(`/groups/${id}/${action}`, {}, message);
  return (
    <>
      <a className="back" href="#/groups">
        ← Eatogether parties
      </a>
      <State data={data} error={error}>
        {g && (
          <>
            <div className="group-top">
              <div>
                <h1>{g.title}</h1>
                <div className="row start">
                  <Status value={g.status} />
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
                    <p className="eyebrow">THE MEETING PLACE</p>
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
                      {g.members.length} of {g.capacity} seats filled
                    </strong>
                    <span>Minimum {g.slot.minimumPartySize} diners to confirm</span>
                  </div>
                </div>
                <h2>A note from your host</h2>
                <p className="group-note">
                  {g.description || "Come along for a relaxed meal and some new company."}
                </p>
                <div className="section-heading">
                  <h2>Who’s joining</h2>
                  <span className="muted small">{g.members.length} diners</span>
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
                      </span>
                    </div>
                  ))}
                  {pending &&
                    Array.from({ length: g.capacity - g.members.length }, (_, i) => (
                      <div className="participant vacant" key={i}>
                        <span className="avatar">+</span>
                        <span>Open seat</span>
                      </div>
                    ))}
                </div>
              </section>
              <aside className="panel action-panel">
                <h2>
                  {g.status === "CONFIRMED"
                    ? "You have a plan."
                    : g.status === "CANCELLED" || g.status === "EXPIRED"
                      ? "This table is closed."
                      : host
                        ? "Your table, your call."
                        : member
                          ? "You’re at the table."
                          : "Pull up a chair."}
                </h2>
                <p>
                  {g.status === "CONFIRMED"
                    ? "The host has confirmed this reservation. Joining and leaving are now closed."
                    : pending
                      ? `The host can confirm once ${g.slot.minimumPartySize} diners have joined. Until then, members can leave freely.`
                      : "Explore other shared tables or start a new one."}
                </p>
                {pending && (
                  <>
                    <div className="seats">
                      <div
                        style={{
                          width: `${(g.members.length / g.capacity) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="small">
                      {g.members.length} joined · {g.capacity - g.members.length} seats
                      remaining
                    </p>
                    {host ? (
                      <>
                        <button
                          disabled={!canConfirm || busy}
                          onClick={() =>
                            perform(
                              "confirm",
                              "Table confirmed. Your shared booking is ready.",
                            )
                          }
                        >
                          Confirm for {g.members.length} diners
                        </button>
                        <p className="small muted">
                          {canConfirm
                            ? "Confirmation closes all remaining seats and fixes the guest list."
                            : `Waiting for ${g.slot.minimumPartySize - g.members.length} more diner(s) to reach the minimum.`}
                        </p>
                      </>
                    ) : member ? (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => perform("leave", "You’ve left the group.")}
                      >
                        Leave group
                      </button>
                    ) : (
                      <button
                        disabled={g.status === "FULL" || busy}
                        onClick={() => perform("join", "You’re in! Your seat is held.")}
                      >
                        {g.status === "FULL" ? "This table is full" : "Join this party"}
                      </button>
                    )}
                  </>
                )}
                {g.booking && member && (
                  <a className="button dark" href="#/bookings">
                    View my bookings →
                  </a>
                )}
                {host &&
                  (pending || g.status === "CONFIRMED") &&
                  (cancelPrompt ? (
                    <div className="cancel-prompt">
                      <p>
                        Cancel this table for everyone? Its reservation slot will be
                        released.
                      </p>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={async () => {
                          await perform(
                            "cancel",
                            "Group cancelled. The table is available again.",
                          );
                          setCancelPrompt(false);
                        }}
                      >
                        Yes, cancel table
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setCancelPrompt(false)}
                      >
                        Keep table
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => setCancelPrompt(true)}
                    >
                      Cancel group
                    </button>
                  ))}
                <div className="fine-note">
                  Your party details stay up to date as diners join.
                </div>
              </aside>
            </div>
          </>
        )}
      </State>
    </>
  );
}
