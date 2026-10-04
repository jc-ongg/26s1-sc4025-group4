import { eventDisplayStatus } from "./booking-history";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { dinerCount } from "./availability";
import type { Group, Restaurant } from "./types";
export const date = (v: string) =>
  new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(v));
export const time = (v: string) =>
  new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(v));
export type Actions = {
  revision: number;
  busy: boolean;
  act: <T = unknown>(
    path: string,
    body: unknown,
    message: string,
    destination?: string | ((data: T) => string),
  ) => Promise<boolean>;
};
// Polling keeps separate diners in sync; the in-flight guard prevents overlapping requests.
export function useResource<T>(path: string, revision: number) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const resourcePath = useRef(path);
  useEffect(() => {
    let active = true,
      fetching = false;
    const controller = new AbortController();
    // Keep current content visible when an action refreshes the same resource.
    if (resourcePath.current !== path) {
      setData(null);
      resourcePath.current = path;
    }
    setError("");
    async function refresh() {
      if (fetching || document.hidden) return;
      if (!navigator.onLine) {
        setError("You’re offline. Reconnect to refresh this page.");
        return;
      }
      fetching = true;
      try {
        const result = await api<T>(path, undefined, { signal: controller.signal });
        if (active) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        fetching = false;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    // Resume immediately after returning to the tab or reconnecting to the host.
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [path, revision]);
  return { data, error };
}
export function State({
  data,
  error,
  children,
}: {
  data: unknown;
  error: string;
  children: ReactNode;
}) {
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error} We’ll retry automatically.
        </p>
      )}
      {data
        ? children
        : !error && (
            <p className="loading" role="status">
              Loading…
            </p>
          )}
    </>
  );
}
export function Art({
  restaurant,
  large = false,
}: {
  restaurant: Pick<Restaurant, "artwork" | "cuisine"> & Partial<Restaurant>;
  large?: boolean;
}) {
  if (restaurant.imagePath)
    return (
      <div className={`food-art photo ${large ? "large" : ""}`}>
        <img
          src={restaurant.imagePath}
          alt={restaurant.name ?? restaurant.cuisine}
          loading="lazy"
          draggable={false}
        />
      </div>
    );
  return (
    <div
      className={`food-art venue-placeholder ${large ? "large" : ""}`}
      role="img"
      aria-label={restaurant.name ?? restaurant.cuisine}
    >
      <span>
        {(restaurant.name ?? restaurant.cuisine)
          .split(/\s+/)
          .filter((word) => /[a-z0-9]/i.test(word))
          .slice(0, 2)
          .map((word) => word[0])
          .join("")}
      </span>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value.toLowerCase()}`}>
      {(
        {
          OPEN: "Waiting for diners",
          FULL: "Waiting for diners",
          CONFIRMED: "Confirmed",
          PAST: "Past",
          UPCOMING: "Upcoming",
          PENDING: "Pending",
          CANCELLED: "Cancelled",
          EXPIRED: "Expired",
        } as Record<string, string>
      )[value] ?? value}
    </span>
  );
}
export function GroupCard({ group: g }: { group: Group }) {
  return (
    <a className="card group-card" href={`#/groups/${g.id}`}>
      <Art restaurant={g.slot.restaurant} />
      <div className="card-body">
        <div className="row">
          <span className="discount">{g.slot.discount}% off</span>
          <Status value={eventDisplayStatus(g)} />
        </div>
        <h3>{g.title}</h3>
        <p className="small">
          {g.slot.restaurant.name} · {g.slot.restaurant.area}
        </p>
        <p className="schedule">
          {date(g.slot.startsAt)} · {time(g.slot.startsAt)}
        </p>
        <div className="seats">
          <div style={{ width: `${(dinerCount(g) / g.capacity) * 100}%` }} />
        </div>
        <div className="row small">
          <span>
            {dinerCount(g)} / {g.capacity} joined
          </span>
          <span>
            {["OPEN", "FULL", "CONFIRMED"].includes(g.status)
              ? `${g.capacity - dinerCount(g)} seats left`
              : "View table"}{" "}
            →
          </span>
        </div>
        <div className="host-line">
          <span className="avatar small-avatar">{g.host.name[0]}</span> Host:{" "}
          {g.host.name}
        </div>
      </div>
    </a>
  );
}
export function RestaurantEventCount({ count }: { count: number | undefined }) {
  return (
    <p className={`small restaurant-event-label ${count ? "" : "muted"}`}>
      {count === undefined
        ? "EatTogether Events · —"
        : `${count} upcoming EatTogether ${count === 1 ? "Event" : "Events"}`}
    </p>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}
