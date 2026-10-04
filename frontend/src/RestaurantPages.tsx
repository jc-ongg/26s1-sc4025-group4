import { useState } from "react";
import { TopPicks } from "./TopPicks";
import { RestaurantMap } from "./RestaurantMap";
import { Discover } from "./Discover";
import { Groups } from "./GroupPages";
import type { Restaurant, Group, User } from "./types";
import { RestaurantBooking } from "./RestaurantBooking";
import { availableSlots, canJoinEvent } from "./availability";
import { Art, Empty, State, useResource, type Actions } from "./dining-ui";

export function Restaurants({
  initialPanel = null,
  ...actions
}: Actions & { initialPanel?: "events" | "discover" | null }) {
  const { revision } = actions;
  const [panel, setPanel] = useState<"events" | "discover" | null>(initialPanel);
  const { data, error } = useResource<{ restaurants: Restaurant[] }>(
    "/restaurants",
    revision,
  );
  const [search, setSearch] = useState(""),
    [cuisine, setCuisine] = useState("All");
  const groupResource = useResource<{ groups: Group[] }>("/groups", revision);
  const groups = groupResource.data?.groups.filter((g) => canJoinEvent(g)) ?? [];
  const [view, setView] = useState<"grid" | "map">("grid");
  const filtered = data?.restaurants.filter(
    (r) =>
      (cuisine === "All" || r.cuisine === cuisine) &&
      `${r.name} ${r.area} ${r.cuisine}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      {data && <TopPicks restaurants={data.restaurants} />}
      <section className="restaurant-browse">
        <div className="section-heading">
          <div>
            <h2>Explore restaurants</h2>
          </div>
          <div className="restaurant-tools">
            <button
              className="secondary"
              aria-expanded={panel === "discover"}
              aria-controls="restaurant-discovery"
              onClick={() => setPanel(panel === "discover" ? null : "discover")}
            >
              For you
            </button>
            <button
              className="secondary"
              aria-expanded={panel === "events"}
              aria-controls="restaurant-discovery"
              onClick={() => setPanel(panel === "events" ? null : "events")}
            >
              EatTogether
            </button>
          </div>
        </div>
        {panel && (
          <section
            className="restaurant-discovery"
            id="restaurant-discovery"
            aria-label={panel === "events" ? "EatTogether Events" : "For you"}
          >
            <div className="row">
              <h2>{panel === "events" ? "EatTogether Events" : "For you"}</h2>
              <button className="text-button" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            {panel === "discover" ? (
              <Discover embedded />
            ) : (
              <Groups {...actions} embedded />
            )}
          </section>
        )}
        <p className="small muted">{filtered?.length ?? 0} restaurants</p>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="Search restaurants"
            placeholder="Restaurant, cuisine or neighbourhood"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="chips" aria-label="Cuisine filters">
          {["All", ...new Set(data?.restaurants.map((r) => r.cuisine) ?? [])].map(
            (item) => (
              <button
                className={`chip ${cuisine === item ? "active" : ""}`}
                key={item}
                aria-pressed={cuisine === item}
                onClick={() => setCuisine(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <div className="browse-toolbar">
          <div className="mode-tabs">
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
        {view === "map" && groupResource.error && (
          <p className="error">Group availability is temporarily unavailable.</p>
        )}
        <State data={data} error={error}>
          {view === "map" ? (
            <RestaurantMap restaurants={filtered ?? []} groups={groups} />
          ) : (
            <div className="grid">
              {filtered?.map((r) => {
                const slots = availableSlots(r);
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
                      {groups.some((g) => g.slot.restaurant.id === r.id) && (
                        <p className="small restaurant-event-label">
                          EatTogether seats available
                        </p>
                      )}
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
          )}
          {filtered?.length === 0 && (
            <Empty
              title="No restaurants found"
              text="Try another cuisine, restaurant name or neighbourhood."
            />
          )}
        </State>
      </section>
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
