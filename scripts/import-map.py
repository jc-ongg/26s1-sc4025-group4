"""Download a small vector basemap once; the app never calls a map provider."""

from urllib.request import Request, urlopen
from urllib.parse import urlencode
from pathlib import Path
import json


def main():
    bbox = "1.22,103.62,1.45,103.89"
    query = f"""[out:json][timeout:120];(
     way[highway~"^(motorway|trunk|primary|secondary|tertiary)$"]({bbox});
     way[railway~"^(rail|subway|light_rail)$"]({bbox});
     way[natural=water]({bbox});way[leisure=park]({bbox});way[natural=coastline]({bbox});
     node[place~"^(suburb|town|quarter)$"]({bbox});
    );out geom;"""
    request = Request(
        "https://overpass-api.de/api/interpreter?" + urlencode({"data": query}),
        headers={"User-Agent": "SC4025-local-demo-map/1.0"},
    )
    data = json.load(urlopen(request, timeout=150))
    if data.get("remark"):
        raise RuntimeError(data["remark"])
    features = []
    for e in data["elements"]:
        tags = e.get("tags", {})
        props = {
            k: tags[k]
            for k in ["name", "highway", "railway", "natural", "leisure", "place"]
            if k in tags
        }
        if e["type"] == "node":
            if not tags.get("name"):
                continue
            geometry = {"type": "Point", "coordinates": [e["lon"], e["lat"]]}
        else:
            coords = [
                [round(p["lon"], 6), round(p["lat"], 6)] for p in e.get("geometry", [])
            ]
            if len(coords) < 2:
                continue
            polygon = coords[0] == coords[-1] and (
                tags.get("natural") == "water" or tags.get("leisure") == "park"
            )
            geometry = {
                "type": "Polygon" if polygon else "LineString",
                "coordinates": [coords] if polygon else coords,
            }
        features.append({"type": "Feature", "properties": props, "geometry": geometry})
    p = Path(__file__).resolve().parents[1] / "frontend/public/maps"
    p.mkdir(parents=True, exist_ok=True)
    (p / "singapore.geojson").write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features}, separators=(",", ":")
        ),
        encoding="utf-8",
    )
    (p / "NOTICE.txt").write_text(
        "Map data © OpenStreetMap contributors, ODbL 1.0.\nhttps://www.openstreetmap.org/copyright\nDownloaded 2026-09-25 using Overpass API. Western and central Singapore overview; not for navigation.\n",
        encoding="utf-8",
    )
    print(
        f'Saved {len(features)} geographic features; {(p/"singapore.geojson").stat().st_size} bytes'
    )


if __name__ == "__main__":
    main()
