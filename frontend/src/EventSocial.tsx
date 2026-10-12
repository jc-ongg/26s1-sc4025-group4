import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Group, User } from "./types";
import { hasStarted } from "./availability";
import { State, useResource, time, type Actions } from "./dining-ui";

export function DinerSafety({
  group,
  target,
  ...actions
}: Actions & { group: Group; target: { id: string; name: string } }) {
  const [open, setOpen] = useState(false),
    [report, setReport] = useState(false),
    [block, setBlock] = useState(false),
    [reason, setReason] = useState("");
  const optionsId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    setReport(false);
    setBlock(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="diner-safety"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        className="text-button"
        ref={trigger}
        aria-label={`Safety options for ${target.name}`}
        aria-expanded={open}
        aria-controls={optionsId}
        onClick={() => setOpen(!open)}
      >
        ···
      </button>
      {open && (
        <div id={optionsId} className="safety-options">
          <div className="row small">
            <strong>{target.name}</strong>
            <button type="button" className="text-button" onClick={close}>
              Close
            </button>
          </div>
          {block ? (
            <>
              <p className="small">
                Blocking is private. You won’t see or Join each other’s future Events. You
                can Leave this upcoming Event without a reliability penalty.
              </p>
              <button
                className="danger"
                disabled={actions.busy}
                onClick={async () => {
                  if (
                    await actions.act(
                      `/groups/${group.id}/safety`,
                      { action: "BLOCK", targetId: target.id },
                      "Diner blocked. You may Leave this Event without a penalty.",
                    )
                  )
                    close();
                }}
              >
                Block {target.name}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setBlock(false)}
              >
                Back
              </button>
            </>
          ) : report ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await actions.act(
                    `/groups/${group.id}/safety`,
                    { action: "REPORT", targetId: target.id, reason },
                    "Report submitted for review.",
                  )
                ) {
                  close();
                  setReason("");
                }
              }}
            >
              <label>
                Report {target.name}
                <textarea
                  required
                  maxLength={1000}
                  rows={3}
                  placeholder="Describe what happened"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button disabled={actions.busy || !reason.trim()}>Submit report</button>
              <button
                type="button"
                className="text-button"
                onClick={() => setReport(false)}
              >
                Back
              </button>
            </form>
          ) : (
            <>
              <button className="text-button" onClick={() => setReport(true)}>
                Report diner
              </button>
              <button
                className="text-button danger-text"
                disabled={actions.busy}
                onClick={() => setBlock(true)}
              >
                Block diner
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Message = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  user: { name: string };
};
function EventChat({ group, user, ...actions }: Actions & { group: Group; user: User }) {
  const { data, error } = useResource<{ messages: Message[] }>(
    `/groups/${group.id}/messages`,
    actions.revision,
  );
  const [body, setBody] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const previousMessage = useRef<string | undefined>(undefined);
  useEffect(() => {
    const newest = data?.messages.at(-1),
      element = log.current;
    if (!element || !newest || newest.id === previousMessage.current) return;
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    if (!previousMessage.current || nearBottom || newest.userId === user.id)
      element.scrollTop = element.scrollHeight;
    previousMessage.current = newest.id;
  }, [data, user.id]);
  return (
    <State data={data} error={error}>
      <div ref={log} className="event-messages" role="log" aria-label="Event messages">
        {data?.messages.length ? (
          data.messages.map((m) => (
            <div
              key={m.id}
              className={`event-message ${m.userId === user.id ? "own" : ""}`}
            >
              <div className="row small">
                <strong>{m.user.name}</strong>
                <div className="row start">
                  <span className="muted">{time(m.createdAt)}</span>
                  {m.userId !== user.id && (
                    <DinerSafety
                      group={group}
                      target={{ id: m.userId, name: m.user.name }}
                      {...actions}
                    />
                  )}
                </div>
              </div>
              <p>{m.body}</p>
            </div>
          ))
        ) : (
          <p className="small muted">No messages yet.</p>
        )}
      </div>
      {!["CANCELLED", "EXPIRED"].includes(group.status) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await actions.act(`/groups/${group.id}/messages`, { body }, ""))
              setBody("");
          }}
          className="chat-compose"
        >
          <label className="sr-only" htmlFor="chat-message">
            Message
          </label>
          <input
            id="chat-message"
            maxLength={1000}
            placeholder="Message your Event"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button disabled={actions.busy || !body.trim()}>Send</button>
        </form>
      )}
    </State>
  );
}

type Feedback = {
  overall: number;
  safety: string;
  social: number;
  meal: number;
  dineAgain: string;
  suggestions: string;
};
function MealFeedback({
  group,
  user,
  ...actions
}: Actions & { group: Group; user: User }) {
  const { data, error } = useResource<{ feedback: Feedback | null }>(
    `/groups/${group.id}/feedback`,
    actions.revision,
  );
  const [overall, setOverall] = useState(""),
    [safety, setSafety] = useState(""),
    [social, setSocial] = useState(""),
    [meal, setMeal] = useState(""),
    [dineAgain, setDineAgain] = useState(""),
    [suggestions, setSuggestions] = useState(""),
    [attended, setAttended] = useState(false);
  const [editing, setEditing] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await actions.act(
        `/groups/${group.id}/feedback`,
        {
          overall: Number(overall),
          safety,
          social: Number(social),
          meal: Number(meal),
          dineAgain,
          suggestions,
          attended,
        },
        "Feedback saved.",
      )
    )
      setEditing(false);
  }
  const rating = (label: string, value: string, set: (value: string) => void) => (
    <fieldset className="star-rating">
      <legend>{label}</legend>
      <div className="star-options">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n <= Number(value) ? "filled" : ""}>
            <input
              className="sr-only"
              type="radio"
              required
              name={label}
              value={n}
              checked={value === String(n)}
              onChange={() => set(String(n))}
            />
            <span aria-hidden="true">{n <= Number(value) ? "★" : "☆"}</span>
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <State data={data} error={error}>
      {data?.feedback && !editing ? (
        <>
          <p className="small">Your private feedback is saved.</p>
          {["SOMEWHAT", "NO"].includes(data.feedback.safety) && (
            <div className="feedback-safety">
              <p className="small">You can report or block a diner.</p>
              {group.members
                .filter((m) => m.userId !== user.id)
                .map((m) => (
                  <div className="row" key={m.userId}>
                    <span>{m.user.name}</span>
                    <DinerSafety group={group} target={m.user} {...actions} />
                  </div>
                ))}
            </div>
          )}
          <button
            className="text-button"
            onClick={() => {
              const f = data.feedback!;
              setOverall(String(f.overall));
              setSafety(f.safety);
              setSocial(String(f.social));
              setMeal(String(f.meal));
              setDineAgain(f.dineAgain);
              setSuggestions(f.suggestions);
              setAttended(true);
              setEditing(true);
            }}
          >
            Edit feedback
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="feedback-form">
          <p className="small muted">
            Optional and private. Skipping feedback does not affect reliability.
          </p>
          {rating("Overall experience", overall, setOverall)}
          <label>
            Did you feel safe?
            <select required value={safety} onChange={(e) => setSafety(e.target.value)}>
              <option value="">Select an answer</option>
              <option value="YES">Yes</option>
              <option value="SOMEWHAT">Somewhat</option>
              <option value="NO">No</option>
            </select>
          </label>
          {rating("Dining with the group", social, setSocial)}
          {rating("The meal", meal, setMeal)}
          <label>
            Would you dine with this group again?
            <select
              required
              value={dineAgain}
              onChange={(e) => setDineAgain(e.target.value)}
            >
              <option value="">Select an answer</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label>
            Suggestions <span className="muted">(optional)</span>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Your feedback"
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
            />
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              required
              checked={attended}
              onChange={(e) => setAttended(e.target.checked)}
            />
            I attended this meal.
          </label>
          {["SOMEWHAT", "NO"].includes(safety) && (
            <div className="feedback-safety">
              <p className="small">You can report or block a diner.</p>
              {group.members
                .filter((m) => m.userId !== user.id)
                .map((m) => (
                  <div className="row" key={m.userId}>
                    <span>{m.user.name}</span>
                    <DinerSafety group={group} target={m.user} {...actions} />
                  </div>
                ))}
            </div>
          )}
          <button disabled={actions.busy}>Save private feedback</button>
        </form>
      )}
    </State>
  );
}
export function EventSocial({
  group,
  user,
  ...actions
}: Actions & { group: Group; user: User }) {
  const [chat, setChat] = useState(false),
    [feedback, setFeedback] = useState(false);
  if (!group.members.some((m) => m.userId === user.id)) return null;
  return (
    <div className="event-social">
      {group.chatOpenedAt && (
        <details onToggle={(e) => setChat(e.currentTarget.open)}>
          <summary>Event Chat</summary>
          {chat && <EventChat group={group} user={user} {...actions} />}
        </details>
      )}
      {hasStarted(group.slot.startsAt) && group.booking?.status === "CONFIRMED" && (
        <details onToggle={(e) => setFeedback(e.currentTarget.open)}>
          <summary>Event Feedback</summary>
          {feedback && <MealFeedback group={group} user={user} {...actions} />}
        </details>
      )}
    </div>
  );
}
