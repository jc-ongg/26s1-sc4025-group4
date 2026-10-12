import { useState } from "react";
import type { User } from "./types";
import { InfoTip } from "./InfoTip";
import { NotificationHistory } from "./Notifications";
import { State, date, time, useResource, type Actions } from "./dining-ui";

export function Profile({ user, revision, act, busy }: Actions & { user: User }) {
  const [diningArea, setDiningArea] = useState("");
  const blocks = useResource<{ blocks: { id: string; name: string }[] }>(
    "/me/blocks",
    revision,
  );
  const reliability = useResource<{
    profile: User & {
      reliabilityStrikes: number;
      suspendedUntil: string | null;
      diningArea: string;
      strikes: { id: string; reason: string; createdAt: string }[];
    };
  }>("/me/profile", revision);
  const now = Date.now();
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
          {user.age && (
            <p className="small muted profile-demographics">
              Age {user.age}
              {user.gender && ` · ${user.gender === "FEMALE" ? "Female" : "Male"}`}
            </p>
          )}
          <div className="profile-reliability">
            <h3>
              <span className="row start">
                Reliability Score{" "}
                <InfoTip label="About reliability">
                  A strike is recorded when you Leave a confirmed Event after Cutoff (two
                  hours before the meal). Strikes expire after 90 days. Three strikes
                  within that period suspend new EatTogether participation for one week.
                  Ordinary bookings stay available. Last Call and safety-related
                  departures are penalty-free.
                </InfoTip>
              </span>
              <span className="badge">Private</span>
            </h3>
            <State data={reliability.data} error={reliability.error}>
              <p className="reliability-count">
                {reliability.data?.profile.reliabilityStrikes}{" "}
                <span>
                  {reliability.data?.profile.reliabilityStrikes === 1
                    ? "active strike"
                    : "active strikes"}
                </span>
              </p>
              {reliability.data?.profile.suspendedUntil &&
                Date.parse(reliability.data.profile.suspendedUntil) > now && (
                  <p className="note small">
                    EatTogether suspended until{" "}
                    {date(reliability.data.profile.suspendedUntil)} ·{" "}
                    {time(reliability.data.profile.suspendedUntil)}.
                  </p>
                )}
              {!!reliability.data?.profile.strikes.length && (
                <details>
                  <summary className="small">Strike history</summary>
                  <ul className="plain-list">
                    {reliability.data.profile.strikes.map((s) => (
                      <li key={s.id} className="small">
                        Late Leave · {date(s.createdAt)} · {time(s.createdAt)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </State>
          </div>
          <details className="profile-setting">
            <summary>Dining area</summary>
            <p className="small muted">
              Last Call invitations within 5 km of your selected area.
            </p>
            {reliability.data?.profile.diningArea && (
              <p className="small">Current area: {reliability.data.profile.diningArea}</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("/me/profile", { diningArea }, "Dining area saved.");
              }}
            >
              <label htmlFor="dining-area">Neighbourhood</label>
              <input
                id="dining-area"
                placeholder="Neighbourhood"
                value={diningArea}
                onChange={(e) => setDiningArea(e.target.value)}
              />
              <button className="secondary" disabled={busy || !diningArea.trim()}>
                Save area
              </button>
              {reliability.data?.profile.diningArea && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    act("/me/profile", { diningArea: "" }, "Dining area cleared.")
                  }
                >
                  Clear area
                </button>
              )}
            </form>
          </details>
          {!!blocks.data?.blocks.length && (
            <details className="profile-setting">
              <summary>Blocked diners</summary>
              <ul className="plain-list">
                {blocks.data.blocks.map((b) => (
                  <li className="row small" key={b.id}>
                    <span>{b.name}</span>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        act(`/me/blocks/${b.id}/remove`, {}, "Diner unblocked.")
                      }
                    >
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
        <NotificationHistory revision={revision} act={act} busy={busy} />
      </div>
    </>
  );
}
