import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { dinerCount, isUpcomingEvent } from "./availability";
import "leaflet/dist/leaflet.css";
import type { Restaurant, Group } from "./types";
import { Art, RestaurantEventCount, Status, date, time } from "./dining-ui";
import { Pagination } from "./Pagination";
import { EventPreferences } from "./EventPreferences";
import { eventDisplayStatus } from "./booking-history";

export function RestaurantMap({
  restaurants,
  groups,
  eventCounts,
  mode = "restaurants",
}: {
  restaurants: Restaurant[];
  groups: Group[];
  eventCounts: Map<string, number> | undefined;
  mode?: "restaurants" | "events";
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const details = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  // Stable marker input avoids rebuilding pins on every availability poll.
  const markerData = JSON.stringify(
    restaurants.map(({ id, name, latitude, longitude, imagePath }) => ({
      id,
      name,
      latitude,
      longitude,
      imagePath,
    })),
  );
  const pins = useRef<L.LayerGroup | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const [eventSelection, setEventSelection] = useState<{
    venueId: string;
    eventId: string;
  } | null>(null);
  useEffect(() => {
    if (!container.current) return;
    setLoading(true);
    setError("");
    const m = L.map(container.current, {
      center: [1.33, 103.76],
      zoom: 12,
      minZoom: 11,
      maxZoom: 17,
      maxBounds: [
        [1.2, 103.6],
        [1.47, 103.91],
      ],
      preferCanvas: true,
      zoomAnimation: false,
    });
    map.current = m;
    m.on("zoomend", () =>
      m.getContainer().classList.toggle("map-labels", m.getZoom() >= 14),
    );
    pins.current = L.layerGroup().addTo(m);
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution(
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    );
    const controller = new AbortController();
    fetch("/maps/singapore.geojson", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        L.geoJSON(data, {
          style: (f) => {
            const p = f?.properties ?? {};
            return {
              color:
                p.natural === "water"
                  ? "#a6c7cf"
                  : p.leisure
                    ? "#bed2ac"
                    : p.railway
                      ? "#b2aaa0"
                      : p.highway === "motorway"
                        ? "#d4b779"
                        : "#d1cfc4",
              weight: p.highway === "motorway" ? 3 : 1.4,
              fillColor: p.natural === "water" ? "#c4dce1" : "#d8e4c7",
              fillOpacity: 0.8,
              dashArray: p.railway ? "4 4" : undefined,
            };
          },
          pointToLayer: (feature, latlng) => {
            const label = document.createElement("span");
            label.textContent = feature.properties?.name;
            return L.marker(latlng, {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "map-place",
                html: label,
                iconSize: [110, 18],
              }),
            });
          },
        })
          .addTo(m)
          .bringToBack();
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setLoading(false);
          setError("The map could not load.");
        }
      });
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(container.current);
    return () => {
      controller.abort();
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    const m = map.current,
      layer = pins.current;
    if (!m || !layer) return;
    layer.clearLayers();
    const venues: Pick<
      Restaurant,
      "id" | "name" | "latitude" | "longitude" | "imagePath"
    >[] = JSON.parse(markerData);
    venues.forEach((r) => {
      if (r.latitude === null || r.longitude === null) return;
      const label = document.createElement("span");
      const photo = document.createElement("img");
      photo.src = r.imagePath ?? "/images/brand/eatigo.png";
      photo.alt = "";
      photo.draggable = false;
      label.appendChild(photo);
      const caption = document.createElement("span");
      caption.className = "pin-name";
      caption.textContent = r.name;
      label.appendChild(caption);
      label.setAttribute("aria-hidden", "true");
      const marker = L.marker([r.latitude, r.longitude], {
        title: r.name,
        alt: r.name,
        icon: L.divIcon({
          className: `restaurant-pin ${selected === r.id ? "chosen" : ""}`,
          html: label,
          iconSize: [52, 52],
          iconAnchor: [26, 26],
        }),
      }).addTo(layer);
      marker.getElement()?.setAttribute("aria-label", r.name);
      const nameLabel = document.createElement("span");
      nameLabel.textContent = r.name;
      marker.bindTooltip(nameLabel, { direction: "top", offset: [0, -16] });
      marker.on("click", () => {
        setSelected(r.id);
        setEventSelection(null);
        m.setView([r.latitude!, r.longitude!], Math.max(m.getZoom(), 15));
        if (window.matchMedia("(max-width: 800px)").matches)
          details.current?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "start",
          });
      });
    });
  }, [markerData, selected, attempt]);
  const r = restaurants.find((r) => r.id === selected),
    open = groups
      .filter((g) => g.slot.restaurant.id === selected && isUpcomingEvent(g))
      .sort(
        (a, b) =>
          Date.parse(a.slot.startsAt) - Date.parse(b.slot.startsAt) ||
          a.id.localeCompare(b.id),
      );
  // Keep the selected Event stable across polling and newly added Events.
  const eventIndex = Math.max(
    0,
    open.findIndex(
      (g) => eventSelection?.venueId === selected && eventSelection.eventId === g.id,
    ),
  );
  const event = open[eventIndex];
  return (
    <div className="map-layout">
      <div>
        <div className="map-tools">
          <span className="small">
            {mode === "events" ? "EatTogether restaurants" : "Restaurants"}
          </span>
          <button
            className="text-button"
            onClick={() => {
              const points = restaurants
                .filter((v) => v.latitude != null && v.longitude != null)
                .map((v) => [v.latitude!, v.longitude!] as [number, number]);
              if (points.length)
                map.current?.fitBounds(points, {
                  padding: [40, 40],
                  maxZoom: 14,
                });
            }}
          >
            Show all restaurants
          </button>
        </div>
        {loading && (
          <p role="status" className="small">
            Loading the map…
          </p>
        )}
        <div
          ref={container}
          className="offline-map"
          aria-label={
            mode === "events"
              ? "EatTogether map of western and central Singapore"
              : "Restaurant map of western and central Singapore"
          }
        />
        {error && (
          <p role="alert" className="error">
            {error}{" "}
            <button className="text-button" onClick={() => setAttempt((n) => n + 1)}>
              Retry map
            </button>
          </p>
        )}
        <p className="small muted">
          Western & central Singapore · Select a pin to explore.
        </p>
      </div>
      <aside ref={details} className="panel map-detail">
        <label className="date-label" htmlFor="map-restaurant">
          Explore a restaurant
        </label>
        <select
          id="map-restaurant"
          value={r?.id ?? ""}
          onChange={(e) => {
            setSelected(e.target.value);
            setEventSelection(null);
            const venue = restaurants.find((v) => v.id === e.target.value);
            if (venue?.latitude != null && venue.longitude != null)
              map.current?.setView([venue.latitude, venue.longitude], 15);
          }}
        >
          <option value="">Select a restaurant</option>
          {restaurants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.area}
            </option>
          ))}
        </select>
        {r ? (
          <>
            <Art restaurant={r} />
            <p className="eyebrow">
              {r.cuisine} · {r.area}
            </p>
            <h3>{r.name}</h3>
            <p className="small">{r.address}</p>
            <RestaurantEventCount
              count={
                mode === "events"
                  ? open.length
                  : eventCounts && (eventCounts.get(r.id) ?? 0)
              }
            />
            {mode === "restaurants" && (
              <a className="button dark" href={`#/restaurants/${r.id}`}>
                Book a table →
              </a>
            )}
            {event && (
              <>
                <a className="map-group" href={`#/groups/${event.id}`}>
                  <div className="row">
                    <strong>{event.title}</strong>
                    <Status value={eventDisplayStatus(event)} />
                  </div>
                  <span>
                    {date(event.slot.startsAt)} · {time(event.slot.startsAt)}
                  </span>
                  <EventPreferences event={event} />
                  <span>
                    {event.capacity > dinerCount(event)
                      ? `${event.capacity - dinerCount(event)} seats left`
                      : "Full"}{" "}
                    ·{" "}
                    {event.discount === 0
                      ? "Full price"
                      : `${event.discount ?? event.slot.discount}% off`}
                  </span>
                  <span className="map-event-action">View Event →</span>
                </a>
                <Pagination
                  total={open.length}
                  page={eventIndex}
                  pageSize={1}
                  label="Events"
                  onPageChange={(next) =>
                    setEventSelection({ venueId: r.id, eventId: open[next].id })
                  }
                />
              </>
            )}
          </>
        ) : (
          <>
            <h3>Select a restaurant</h3>
            <p className="small">
              Each pin marks a restaurant. Hover or focus to see its name; select it to
              explore. You can also use the restaurant list above.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
