export type MenuItem = { name: string; cents: number };
// Presentation fixtures: Joya follows the supplied menu reference; other menus
// use indicative prices for the demo. No restaurant ordering/payment is implied.
const menus: Record<string, MenuItem[]> = {
  joya: [
    { name: "Beef Sukiyaki Pot", cents: 1690 },
    { name: "Joya Chirashi Don", cents: 1690 },
    { name: "Unagi Don", cents: 1690 },
    { name: "Mentai Salmon Don", cents: 1590 },
    { name: "Ribeye Steak", cents: 2300 },
    { name: "Lamb Loin Chop", cents: 2200 },
  ],
  seorae: [
    { name: "Galmaegisal", cents: 2390 },
    { name: "Pork Belly", cents: 2190 },
    { name: "Beef Short Plate", cents: 2590 },
  ],
  peacock: [
    { name: "Biryani", cents: 1390 },
    { name: "Paneer Curry", cents: 1290 },
    { name: "Naan", cents: 390 },
  ],
  "lazy-lizard": [
    { name: "Beef Burger", cents: 1890 },
    { name: "Chicken Wings", cents: 1290 },
    { name: "Pasta", cents: 1690 },
  ],
  "yan-lai-ju": [
    { name: "Grilled Fish", cents: 3890 },
    { name: "La Zi Ji", cents: 1890 },
    { name: "Mini Crayfish", cents: 2690 },
  ],
  "two-scoops": [
    { name: "Single Scoop Gelato", cents: 450 },
    { name: "Double Scoop Gelato", cents: 800 },
    { name: "Waffles", cents: 650 },
  ],
  "il-cielo": [
    { name: "House-made Pasta", cents: 2800 },
    { name: "Pizza", cents: 2600 },
    { name: "Tiramisu", cents: 1400 },
  ],
  lime: [
    { name: "Lunch Buffet — Adult", cents: 6800 },
    { name: "Dinner Buffet — Adult", cents: 8800 },
  ],
};
export const menuFor = (id: string) => menus[id] ?? [];
export function discountedCents(cents: number, discount: number) {
  return Math.round((cents * (100 - discount)) / 100);
}
export const money = (cents: number) => `SGD ${(cents / 100).toFixed(2)}`;
