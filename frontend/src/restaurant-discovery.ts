import type { Group, Restaurant } from "./types";
import { availableSlots, canJoinEvent, isUpcomingEvent } from "./availability";

export type RestaurantFilters = {
  search: string;
  cuisine: string;
  price: string;
  minimumDiscount: number;
  eatTogether: "any" | "events" | "seats";
};

export const defaultRestaurantFilters: RestaurantFilters = {
  search: "",
  cuisine: "All",
  price: "any",
  minimumDiscount: 0,
  eatTogether: "any",
};

export function discoverRestaurants(
  restaurants: Restaurant[],
  groups: Group[],
  filters: RestaurantFilters,
  now = Date.now(),
) {
  const query = filters.search.trim().toLowerCase();
  const upcoming = groups.filter((g) => isUpcomingEvent(g, now));
  return restaurants.flatMap((restaurant) => {
    if (!restaurant.active) return [];
    if (filters.cuisine !== "All" && restaurant.cuisine !== filters.cuisine) return [];
    const priceMatches =
      filters.price === "any" ||
      (filters.price === "premium"
        ? /^\${4,}$/.test(restaurant.price)
        : restaurant.price === filters.price);
    if (!priceMatches) return [];
    const matchesRestaurant =
      `${restaurant.name} ${restaurant.cuisine} ${restaurant.area}`
        .toLowerCase()
        .includes(query);
    // Match each booking route independently: an unrelated 50% slot must not
    // make a 30% Event appear under the 50% EatTogether filter.
    const events = upcoming.filter(
      (g) =>
        g.slot.restaurant.id === restaurant.id &&
        (matchesRestaurant || g.title.toLowerCase().includes(query)) &&
        (g.discount ?? g.slot.discount) >= filters.minimumDiscount &&
        (filters.eatTogether !== "seats" || canJoinEvent(g, now)),
    );
    const slots = availableSlots(restaurant, now).filter(
      (s) => s.discount >= filters.minimumDiscount,
    );
    const ordinaryMatches =
      matchesRestaurant && (filters.minimumDiscount === 0 || slots.length > 0);
    if (
      filters.eatTogether !== "any" ? !events.length : !ordinaryMatches && !events.length
    )
      return [];
    return [{ restaurant, events, slots }];
  });
}
