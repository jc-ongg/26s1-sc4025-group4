import { useState } from "react";
import { Pagination } from "./Pagination";
import { CompassIcon } from "./icons";
import { TopPicks } from "./TopPicks";
import { RestaurantMap } from "./RestaurantMap";
import { DiscoveryDialog } from "./DiscoveryDialog";
import { Groups } from "./GroupPages";
import type { Restaurant, Group, User } from "./types";
import { RestaurantBooking } from "./RestaurantBooking";
import { availableSlots, isUpcomingEvent, upcomingEventCounts } from "./availability";
import {
  Art,
  Empty,
  RestaurantEventCount,
  State,
  useResource,
  type Actions,
} from "./dining-ui";

export function Restaurants({
  initialCollection = "restaurants",
  initialDiscoveryOpen = false,
  ...actions
}: Actions & {
  initialCollection?: "restaurants" | "events";
  initialDiscoveryOpen?: boolean;
}) {
  const { data, error } = useResource<{ restaurants: Restaurant[] }>(
    "/restaurants",
    actions.revision,
  );
  const groupResource = useResource<{ groups: Group[] }>("/groups", actions.revision);
  const [collection, setCollection] = useState<"restaurants" | "events">(
    initialCollection,
  );
  const [discoveryOpen, setDiscoveryOpen] = useState(initialDiscoveryOpen);
  const [search, setSearch] = useState(""),
    [cuisine, setCuisine] = useState("All"),
    [view, setView] = useState<"grid" | "map">("grid");
  const [page, setPage] = useState(0),
    pageSize = 3;
  const cuisines = [...new Set(data?.restaurants.map((r) => r.cuisine) ?? [])].sort();
  const now = Date.now(),
    groups = groupResource.data?.groups.filter((g) => isUpcomingEvent(g, now));
  const eventCounts = groups && upcomingEventCounts(groups, now);
  const matches = (r: Restaurant, title = "") =>
    (cuisine === "All" || r.cuisine === cuisine) &&
    `${r.name} ${r.area} ${r.cuisine} ${title}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  const restaurants = data?.restaurants.filter((r) => matches(r)),
    events = groups?.filter((g) => matches(g.slot.restaurant, g.title));
  const count = collection === "restaurants" ? restaurants?.length : events?.length;
  const countLabel =
    collection === "restaurants"
      ? count === 1
        ? "restaurant"
        : "restaurants"
      : count === 1
        ? "Event"
        : "Events";
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil((restaurants?.length ?? 0) / pageSize) - 1),
  );
  // Maps retain all matching locations. Pagination limits cards, not the map's pins.
  const mapRestaurants =
    collection === "events"
      ? data?.restaurants.filter((r) =>
          events?.some((g) => g.slot.restaurant.id === r.id),
        )
      : restaurants;

  return (
    <>
      {data && <TopPicks restaurants={data.restaurants} eventCounts={eventCounts} />}
      <section className="restaurant-browse">
        <div className="section-heading">
          <h2>
            {collection === "restaurants" ? "Explore restaurants" : "EatTogether Events"}
          </h2>
          <span className="small muted">
            {count === undefined ? "Loading…" : `${count} ${countLabel}`}
          </span>
        </div>
        <div className="discovery-toolbar">
          <button
            className="for-you-trigger"
            aria-haspopup="dialog"
            aria-expanded={discoveryOpen}
            aria-controls="for-you-dialog"
            onClick={() => setDiscoveryOpen(true)}
          >
            <CompassIcon />
            <span>For you</span>
            <span aria-hidden="true">→</span>
          </button>
          <div className="mode-tabs collection-toggle" role="group" aria-label="Browse">
            {(["restaurants", "events"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={collection === value}
                className={collection === value ? "selected" : ""}
                onClick={() => {
                  setCollection(value);
                  setPage(0);
                }}
              >
                {value === "restaurants" ? "Restaurants" : "EatTogether"}
              </button>
            ))}
          </div>
        </div>
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label={
              collection === "restaurants"
                ? "Search restaurants"
                : "Search EatTogether Events"
            }
            placeholder={
              collection === "restaurants"
                ? "Restaurant, cuisine or neighbourhood"
                : "Event, restaurant or neighbourhood"
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="chips" aria-label="Cuisine filters">
          {["All", ...cuisines].map((item) => (
            <button
              className={`chip ${cuisine === item ? "active" : ""}`}
              key={item}
              aria-pressed={cuisine === item}
              onClick={() => {
                setCuisine(item);
                setPage(0);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="browse-toolbar">
          <div className="mode-tabs" role="group" aria-label="Browse view">
            <button
              aria-pressed={view === "grid"}
              className={view === "grid" ? "selected" : ""}
              onClick={() => setView("grid")}
            >
              {collection === "restaurants" ? "Restaurant view" : "Event view"}
            </button>
            <button
              aria-pressed={view === "map"}
              className={view === "map" ? "selected" : ""}
              onClick={() => setView("map")}
            >
              Map view
            </button>
          </div>
        </div>
        {view === "map" ? (
          <State
            data={collection === "events" ? data && groupResource.data : data}
            error={error || groupResource.error}
          >
            <RestaurantMap
              restaurants={mapRestaurants ?? []}
              groups={collection === "events" ? (events ?? []) : (groups ?? [])}
              eventCounts={eventCounts}
              mode={collection}
            />
            {mapRestaurants?.length === 0 && (
              <Empty
                title={
                  collection === "events" ? "No Events found" : "No restaurants found"
                }
                text="Try another cuisine or search."
              />
            )}
          </State>
        ) : collection === "events" ? (
          <div className="browse-results">
            <Groups
              key={`${search}:${cuisine}`}
              groups={events ?? null}
              error={groupResource.error}
            />
          </div>
        ) : (
          <div className="browse-results">
            {groupResource.error && (
              <p className="error">
                EatTogether availability is temporarily unavailable.
              </p>
            )}
            <State data={data} error={error}>
              <div className="grid">
                {restaurants
                  ?.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                  .map((r) => {
                    const slots = availableSlots(r, now);
                    return (
                      <a className="card" href={`#/restaurants/${r.id}`} key={r.id}>
                        <Art restaurant={r} />
                        <div className="card-body">
                          <div className="row">
                            <span className="eyebrow">{r.cuisine}</span>
                            <span className="small muted">{r.price}</span>
                          </div>
                          <h3>{r.name}</h3>
                          <p className="small">{r.area}</p>
                          <RestaurantEventCount
                            count={eventCounts && (eventCounts.get(r.id) ?? 0)}
                          />
                          <div className="row">
                            <span className="discount">
                              {slots.length
                                ? `Up to ${Math.max(...slots.map((s) => s.discount))}% off`
                                : "No available times"}
                            </span>
                            <span className="small">View restaurant →</span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
              </div>
              {restaurants?.length === 0 && (
                <Empty
                  title="No restaurants found"
                  text="Try another cuisine, restaurant name or neighbourhood."
                />
              )}
              <Pagination
                total={restaurants?.length ?? 0}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                label="restaurants"
              />
            </State>
          </div>
        )}
      </section>
      <DiscoveryDialog
        open={discoveryOpen}
        onClose={() => setDiscoveryOpen(false)}
        cuisines={cuisines}
        initialCuisine={cuisine === "All" ? "" : cuisine}
        eventCounts={eventCounts}
      />
    </>
  );
}

export function RestaurantDetail({
  id,
  user,
  ...actions
}: Actions & { id: string; user: User }) {
  const { data, error } = useResource<{ restaurant: Restaurant; groups: Group[] }>(
    `/restaurants/${encodeURIComponent(id)}`,
    actions.revision,
  );
  const r = data?.restaurant;
  return (
    <>
      <a className="back" href="#/restaurants">
        ← All restaurants
      </a>
      <State data={data} error={error}>
        {r && (
          <>
            <div className="restaurant-banner">
              <Art restaurant={r} large />
              <div className="restaurant-heading">
                <p className="eyebrow">
                  {r.cuisine} · {r.area} · {r.price}
                </p>
                <h1>{r.name}</h1>
                <p>{r.description}</p>
                <p className="small">{r.address}</p>
                <div className="chips">
                  {r.tags?.map((tag) => (
                    <span className="badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <RestaurantBooking
              restaurant={r}
              groups={data.groups}
              user={user}
              {...actions}
            />
          </>
        )}
      </State>
    </>
  );
}
