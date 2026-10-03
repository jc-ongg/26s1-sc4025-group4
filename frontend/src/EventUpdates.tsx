import { useEffect, useRef, useState } from "react";
import type { Group } from "./types";
import { eventUpdateMessage } from "./event-feedback";

export function EventUpdates({ group, userId }: { group?: Group; userId: string }) {
  const previous = useRef<Group | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!group) return;
    if (previous.current?.id !== group.id) setMessage("");
    const update = eventUpdateMessage(previous.current, group, userId);
    previous.current = group;
    if (update) setMessage(update);
  }, [group, userId]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return message ? (
    <div className="event-update" role="status" aria-live="polite" aria-atomic="true">
      <span>{message}</span>
      <button
        className="text-button"
        aria-label="Dismiss Event update"
        onClick={() => setMessage("")}
      >
        ×
      </button>
    </div>
  ) : null;
}
