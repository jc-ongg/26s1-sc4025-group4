export const centres: Record<string, [number, number]> = {
  ntu: [1.3483, 103.6831],
  jurong: [1.333, 103.742],
  clementi: [1.315, 103.765],
  city: [1.293, 103.852],
  "city hall": [1.293, 103.852],
  "jurong east": [1.333, 103.742],
  "jurong west": [1.34, 103.709],
  "joo koon": [1.327, 103.678],
  orchard: [1.304, 103.832],
  chinatown: [1.284, 103.844],
  "bukit batok": [1.349, 103.749],
  "bukit timah": [1.329, 103.797],
  "holland village": [1.311, 103.796],
  "nanyang technological university": [1.3483, 103.6831],
};
export function distance(lat: number, lon: number, centre: [number, number]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat - centre[0]) * rad) / 2) ** 2 +
    Math.cos(lat * rad) *
      Math.cos(centre[0] * rad) *
      Math.sin(((lon - centre[1]) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
