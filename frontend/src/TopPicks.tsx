import { useRef } from "react";
import { Art } from "./dining-ui";
import type { Restaurant } from "./types";

export function TopPicks({ restaurants }: { restaurants: Restaurant[] }) {
  const track = useRef<HTMLDivElement>(null);
  const picks = restaurants.filter((r) => r.slots.some((s) => !s.allocation));
  if (!picks.length) return null;

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
            aria-label="Previous top picks"
            onClick={() => scroll(-1)}
          >
            ←
          </button>
          <button
            className="secondary"
            aria-label="Next top picks"
            onClick={() => scroll(1)}
          >
            →
          </button>
        </div>
      </div>
      <div className="picks-track" ref={track}>
        {picks.map((restaurant) => (
          <a
            className="pick-card"
            href={`#/restaurants/${restaurant.id}`}
            key={restaurant.id}
          >
            <Art restaurant={restaurant} />
            <div className="pick-caption">
              <span className="pick-discount">
                Up to{" "}
                {Math.max(
                  ...restaurant.slots.filter((s) => !s.allocation).map((s) => s.discount),
                )}
                % off
              </span>
              <h3>{restaurant.name}</h3>
              <p>
                {restaurant.cuisine} · {restaurant.area}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
