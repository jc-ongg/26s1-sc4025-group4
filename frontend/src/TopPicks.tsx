import { useRef } from "react";
import { Art, RestaurantEventCount } from "./dining-ui";
import type { Restaurant } from "./types";
import { availableSlots } from "./availability";

export function TopPicks({
  restaurants,
  eventCounts,
}: {
  restaurants: Restaurant[] | undefined;
  eventCounts: Map<string, number> | undefined;
}) {
  const track = useRef<HTMLDivElement>(null);
  const picks = (restaurants ?? [])
    .map((restaurant) => ({ restaurant, slots: availableSlots(restaurant) }))
    .filter(({ slots }) => slots.length);
  if (restaurants && !picks.length) return null;

  function scroll(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <section className="top-picks" aria-labelledby="top-picks-title">
      <div className="section-heading">
        <h2 id="top-picks-title">Top picks</h2>
        <div className="carousel-controls">
          <button
            className="secondary"
            disabled={!restaurants}
            aria-label="Previous top picks"
            onClick={() => scroll(-1)}
          >
            ←
          </button>
          <button
            className="secondary"
            disabled={!restaurants}
            aria-label="Next top picks"
            onClick={() => scroll(1)}
          >
            →
          </button>
        </div>
      </div>
      <div className="picks-track" ref={track}>
        {!restaurants &&
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="pick-card pick-placeholder" aria-hidden="true" />
          ))}
        {picks.map(({ restaurant, slots }) => (
          <a
            className="pick-card"
            href={`#/restaurants/${restaurant.id}`}
            key={restaurant.id}
          >
            <Art restaurant={restaurant} />
            <div className="pick-caption">
              <span className="pick-discount">
                Up to {Math.max(...slots.map((s) => s.discount))}% off
              </span>
              <h3>{restaurant.name}</h3>
              <p>
                {restaurant.cuisine} · {restaurant.area}
              </p>
              <RestaurantEventCount
                count={eventCounts && (eventCounts.get(restaurant.id) ?? 0)}
              />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
