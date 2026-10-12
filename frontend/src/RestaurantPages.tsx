import { useState } from "react";
import { Pagination } from "./Pagination";
import { CompassIcon } from "./icons";
import { TopPicks } from "./TopPicks";
import { RestaurantMap } from "./RestaurantMap";
import { DiscoveryDialog } from "./DiscoveryDialog";
import { VenueEvents } from "./VenueEvents";
import { useContentMotion } from "./motion";
import {
  defaultRestaurantFilters,
  discoverRestaurants,
  type RestaurantFilters,
} from "./restaurant-discovery";
import type { Restaurant, Group, User } from "./types";
import { RestaurantBooking } from "./RestaurantBooking";
import { upcomingEventCounts } from "./availability";
import { Art, Empty, State, useResource, type Actions } from "./dining-ui";

export function Restaurants({
  initialEatTogether = false,
  initialDiscoveryOpen = false,
  ...actions
}: Actions & {
  initialEatTogether?: boolean;
  initialDiscoveryOpen?: boolean;
}) {
  const { data, error } = useResource<{ restaurants: Restaurant[] }>(
    "/restaurants",
    actions.revision,
  );
  const groupResource = useResource<{ groups: Group[] }>("/groups", actions.revision);
  const [discoveryOpen, setDiscoveryOpen] = useState(initialDiscoveryOpen);
  const [filters, setFilters] = useState<RestaurantFilters>({
    ...defaultRestaurantFilters,
    eatTogether: initialEatTogether ? "events" : "any",
  });
  const [view, setView] = useState<"grid" | "map">("grid");
  const [page, setPage] = useState(0),
    pageSize = 3;
  const cuisines = [...new Set(data?.restaurants.map((r) => r.cuisine) ?? [])].sort();
  const groups = groupResource.data?.groups;
  const results = discoverRestaurants(data?.restaurants ?? [], groups ?? [], filters);
  const matchingEvents = results.flatMap((result) => result.events);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(results.length / pageSize) - 1),
  );
  const readyData = filters.eatTogether === "any" ? data : data && groupResource.data;
  const browse = useContentMotion<HTMLDivElement>(
    [
      view,
      currentPage,
      filters.cuisine,
      filters.price,
      filters.minimumDiscount,
      filters.eatTogether,
      !!readyData,
    ].join(":"),
  );
  const hasFilters = Object.keys(defaultRestaurantFilters).some(
    (key) =>
      filters[key as keyof RestaurantFilters] !==
      defaultRestaurantFilters[key as keyof RestaurantFilters],
  );
  function update<K extends keyof RestaurantFilters>(
    key: K,
    value: RestaurantFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  }
  return (
    <>
      {data && (
        <TopPicks
          restaurants={data.restaurants}
          eventCounts={groups && upcomingEventCounts(groups)}
        />
      )}
      <section className="restaurant-browse">
        <div className="section-heading">
          <h2>Explore restaurants</h2>
          <span className="small muted" aria-live="polite">
            {readyData
              ? `${results.length} ${results.length === 1 ? "Restaurant" : "Restaurants"} · ${groups ? matchingEvents.length : "—"} EatTogether ${matchingEvents.length === 1 && groups ? "Event" : "Events"}`
              : "Loading…"}
          </span>
        </div>
        <div className="discovery-toolbar">
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search restaurants"
              placeholder="Restaurant, cuisine, neighbourhood or Event"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </label>
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
        </div>
        <div className="chips" aria-label="Cuisine filters">
          {["All", ...cuisines].map((item) => (
            <button
              className={`chip ${filters.cuisine === item ? "active" : ""}`}
              key={item}
              aria-pressed={filters.cuisine === item}
              onClick={() => update("cuisine", item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="restaurant-filters">
          <label>
            EatTogether
            <select
              value={filters.eatTogether}
              onChange={(e) =>
                update("eatTogether", e.target.value as RestaurantFilters["eatTogether"])
              }
            >
              <option value="any">Any restaurant</option>
              <option value="events">With Events</option>
              <option value="seats">With seats available</option>
            </select>
          </label>
          <label>
            Minimum discount
            <select
              value={filters.minimumDiscount}
              onChange={(e) => update("minimumDiscount", Number(e.target.value))}
            >
              <option value={0}>Any discount</option>
              {[10, 20, 30, 40, 50].map((value) => (
                <option key={value} value={value}>
                  {value}% or more
                </option>
              ))}
            </select>
          </label>
          <label>
            Price band
            <select
              value={filters.price}
              onChange={(e) => update("price", e.target.value)}
            >
              <option value="any">Any price</option>
              {["$", "$$", "$$$"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              <option value="premium">$$$$+</option>
            </select>
          </label>
          <button
            className="text-button"
            disabled={!hasFilters}
            onClick={() => {
              setFilters({ ...defaultRestaurantFilters });
              setPage(0);
            }}
          >
            Clear filters
          </button>
        </div>
        <div className="browse-toolbar">
          <div className="mode-tabs" role="group" aria-label="Browse view">
            <button
              aria-pressed={view === "grid"}
              className={view === "grid" ? "selected" : ""}
              onClick={() => setView("grid")}
            >
              Restaurant view
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
        {groupResource.error && filters.eatTogether === "any" && (
          <p className="error">EatTogether availability is temporarily unavailable.</p>
        )}
        <div ref={browse}>
          <State
            data={readyData}
            error={error || (filters.eatTogether !== "any" ? groupResource.error : "")}
          >
            {!results.length ? (
              <Empty
                title="No restaurants found"
                text="Try another search or clear your filters."
              />
            ) : view === "map" ? (
              <RestaurantMap
                restaurants={results.map((result) => result.restaurant)}
                groups={groups ? matchingEvents : undefined}
              />
            ) : (
              <div className="browse-results">
                <div className="grid">
                  {results
                    .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                    .map(({ restaurant: r, events, slots }) => (
                      <article className="card restaurant-card" key={r.id}>
                        <a
                          className="restaurant-photo-link"
                          href={`#/restaurants/${r.id}`}
                          aria-label={`View ${r.name}`}
                        >
                          <Art restaurant={r} />
                        </a>
                        <div className="card-body">
                          <div className="row">
                            <span className="eyebrow">{r.cuisine}</span>
                            <span className="small muted">{r.price}</span>
                          </div>
                          <h3>
                            <a href={`#/restaurants/${r.id}`}>{r.name}</a>
                          </h3>
                          <p className="small">{r.area}</p>
                          <div className="row restaurant-booking-action">
                            <span className="discount">
                              {slots.length
                                ? `Up to ${Math.max(...slots.map((s) => s.discount))}% off`
                                : filters.minimumDiscount > 0
                                  ? "No matching times"
                                  : "No available times"}
                            </span>
                            <a href={`#/restaurants/${r.id}`}>Book a table →</a>
                          </div>
                          <VenueEvents
                            events={groups ? events : undefined}
                            restaurantName={r.name}
                          />
                        </div>
                      </article>
                    ))}
                </div>
                <Pagination
                  total={results.length}
                  page={currentPage}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  label="Restaurants"
                />
              </div>
            )}
          </State>
        </div>
      </section>
      <DiscoveryDialog
        open={discoveryOpen}
        onClose={() => setDiscoveryOpen(false)}
        eventCounts={groups && upcomingEventCounts(groups)}
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
