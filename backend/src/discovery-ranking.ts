type SearchVenue = {
  name: string;
  cuisine: string;
  description: string;
  tags: string[];
  signatureDishes: string[];
};

// These are spelling/menu synonyms, not pre-written recommendations. Eligibility,
// location and the venue's actual menu still decide what can be returned.
export function normalizeDiningText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bice[\s-]*creams?\b/g, "ice cream")
    .replace(/\bgelatos?\b/g, "ice cream")
    .replace(/\bk[\s-]?bbq\b/g, "korean barbecue")
    .replace(/\b(bbq|barbeque|barbecues)\b/g, "barbecue")
    .replace(/\bcurries\b/g, "curry")
    .replace(/\b(burger|waffle|dumpling|noodle|dessert|bowl|wing)s\b/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function venueSearchText(venue: SearchVenue) {
  // Names and neighbourhoods dominate short queries without explaining the food.
  // Name lookup is handled separately; location is an eligibility constraint.
  return `${venue.cuisine}. ${venue.description} ${venue.tags.join(", ")}. ${venue.signatureDishes.join(", ")}`;
}

const cuisines = [
  "japanese",
  "korean",
  "chinese",
  "western",
  "italian",
  "indian",
  "thai",
  "mexican",
  "vietnamese",
  "french",
  "mediterranean",
  "malay",
  "indonesian",
  "dessert",
  "buffet",
];
const dishes = [
  "ice cream",
  "waffle",
  "barbecue",
  "burger",
  "pizza",
  "pasta",
  "tiramisu",
  "curry",
  "biryani",
  "naan",
  "paneer",
  "rice bowl",
  "unagi",
  "chirashi",
  "mentai salmon",
  "pork belly",
  "grilled fish",
  "crayfish",
  "chicken wing",
];
const includesPhrase = (text: string, phrase: string) =>
  ` ${text} `.includes(` ${phrase} `);
function isExcluded(text: string, phrase: string) {
  return [
    "no",
    "not",
    "without",
    "avoid",
    "excluding",
    "except",
    "dont want",
    "don t want",
  ].some((prefix) => includesPhrase(text, `${prefix} ${phrase}`));
}

export function diningIntent(mood: string, explicitCuisine = "") {
  const query = normalizeDiningText(mood);
  const wanted = (terms: string[]) =>
    terms.filter((term) => includesPhrase(query, term) && !isExcluded(query, term));
  const unwanted = (terms: string[]) => terms.filter((term) => isExcluded(query, term));
  return {
    query,
    cuisines: explicitCuisine.trim()
      ? [normalizeDiningText(explicitCuisine)]
      : wanted(cuisines),
    dishes: explicitCuisine.trim() ? [] : wanted(dishes),
    excludedCuisines: unwanted(cuisines),
    excludedDishes: unwanted(dishes),
  };
}

export function menuMatch(venue: SearchVenue, intent: ReturnType<typeof diningIntent>) {
  const cuisine = normalizeDiningText(venue.cuisine);
  const menu = normalizeDiningText(venueSearchText(venue));
  const nameMatch = includesPhrase(intent.query, normalizeDiningText(venue.name));
  if (
    intent.excludedCuisines.includes(cuisine) ||
    intent.excludedDishes.some((term) => includesPhrase(menu, term))
  )
    return null;
  if (intent.cuisines.length && !intent.cuisines.includes(cuisine)) return null;
  const matchedDishes = intent.dishes.filter((term) => includesPhrase(menu, term));
  if (intent.dishes.length && !matchedDishes.length) return null;
  return {
    exact: nameMatch || !!intent.cuisines.length || !!matchedDishes.length,
    reason: nameMatch
      ? `Matches ${venue.name}`
      : matchedDishes.length
        ? `Matches ${matchedDishes.join(", ")}`
        : intent.cuisines.length
          ? `Matches ${venue.cuisine.toLowerCase()} food`
          : "Matches your dining mood",
  };
}

export function relevantResults<T extends { similarity: number; exact: boolean }>(
  rows: T[],
) {
  const best = Math.max(0, ...rows.map((r) => r.similarity));
  // Calibrated against this local model and catalogue. Cosine similarity is not a
  // confidence percentage. Keep a floor and a relative band, never pad with venues.
  return rows
    .filter(
      (row) => row.exact || (row.similarity >= 0.28 && row.similarity >= best - 0.1),
    )
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.similarity - a.similarity)
    .slice(0, 6);
}
