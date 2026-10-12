import { useId, useState } from "react";
import type { Group } from "./types";
import { currentGroupStatus, dinerCount } from "./availability";
import { EventPreferences } from "./EventPreferences";
import { Status, date, time } from "./dining-ui";
import { Pagination } from "./Pagination";
import { useContentMotion } from "./motion";

// Cards and the map share the same Event information and navigation.
export function VenueEvents({
  events,
  restaurantName,
  defaultOpen = false,
}: {
  events: Group[] | undefined;
  restaurantName: string;
  defaultOpen?: boolean;
}) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sorted = [...(events ?? [])].sort(
    (a, b) =>
      Date.parse(a.slot.startsAt) - Date.parse(b.slot.startsAt) ||
      a.id.localeCompare(b.id),
  );
  // Keep the chosen Event through polling; fall back if it leaves the results.
  const page = Math.max(
    0,
    sorted.findIndex((g) => g.id === selectedId),
  );
  const event = sorted[page];
  const content = useContentMotion<HTMLDivElement>(event?.id ?? "empty");
  return (
    <section className="venue-events" aria-label={`EatTogether at ${restaurantName}`}>
      {events === undefined ? (
        <p className="small muted">EatTogether Events · —</p>
      ) : !events.length ? (
        <p className="small muted">No upcoming EatTogether Events</p>
      ) : (
        <>
          <button
            className="venue-events-trigger"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen(!open)}
          >
            <span>
              {events.length} EatTogether {events.length === 1 ? "Event" : "Events"}
            </span>
            <span aria-hidden="true">{open ? "−" : "+"}</span>
          </button>
          {event && (
            <div
              id={contentId}
              className={`venue-events-content ${open ? "expanded" : ""}`}
              inert={!open}
              aria-hidden={!open}
            >
              <div ref={content} className="venue-events-inner">
                <a className="venue-event-link" href={`#/groups/${event.id}`}>
                  <div className="row">
                    <strong>{event.title}</strong>
                    <Status value={currentGroupStatus(event)} />
                  </div>
                  <span>
                    {date(event.slot.startsAt)} · {time(event.slot.startsAt)}
                  </span>
                  <EventPreferences event={event} />
                  <span>
                    {Math.max(0, event.capacity - dinerCount(event)) > 0
                      ? `${event.capacity - dinerCount(event)} seats available`
                      : "Full"}{" "}
                    ·{" "}
                    {event.discount === 0
                      ? "Full price"
                      : `${event.discount ?? event.slot.discount}% off`}
                  </span>
                  <span className="venue-event-action">View Event →</span>
                </a>
                {sorted.length > 1 && (
                  <Pagination
                    total={sorted.length}
                    page={page}
                    pageSize={1}
                    onPageChange={(next) => setSelectedId(sorted[next].id)}
                    label="Events"
                    navigationLabel={`${restaurantName} Event pages`}
                    showTotal={false}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
