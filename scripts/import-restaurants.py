"""Refresh the small, attributed public venue snapshot. Does not fetch reviews."""

from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
import json
import re

VENUES = [
    (
        "joya",
        "3394068428925",
        "Joya Onsen Cafe",
        "Japanese",
        "Joo Koon",
        "Japanese rice bowls such as chirashi, unagi and mentai salmon in an onsen-inspired setting on Upper Jurong Road.",
        ["Rice bowls", "Japanese", "Relaxed"],
        ["Chirashi don", "Unagi don", "Mentai salmon don"],
    ),
    (
        "seorae",
        "3370046945003",
        "Seorae Korean Charcoal BBQ",
        "Korean",
        "Jurong East",
        "Korean charcoal barbecue at JEM, with pork skirt, pork belly and beef cuts for grilling and sharing over a lively meal.",
        ["Barbecue", "Sharing plates", "Lively"],
        ["Galmaegisal", "Pork belly", "Beef short plate"],
    ),
    (
        "peacock",
        "3375064665252",
        "Peacock North Indian Restaurant",
        "Indian",
        "Clementi",
        "North Indian cooking at NEWest: curries, biryani, paneer dishes and naan, with Indian desserts to finish.",
        ["Curries", "Paneer options", "Casual"],
        ["Biryani", "Paneer", "Naan"],
    ),
    (
        "lazy-lizard",
        "3374314503596",
        "Lazy Lizard",
        "Western",
        "Clementi",
        "A casual NEWest restaurant serving Western favourites including burgers and chicken wings, suited to meals with friends and family.",
        ["Burgers", "Sharing plates", "Casual"],
        ["Burgers", "Chicken wings"],
    ),
    (
        "yan-lai-ju",
        "3372469572815",
        "Yan Lai Ju",
        "Chinese",
        "Jurong East",
        "Chinese cooking at Vision Exchange featuring grilled fish, spicy chicken and crayfish. A flavourful choice for a shared meal.",
        ["Spicy", "Grilled fish", "Sharing plates"],
        ["Grilled fish", "La Zi Ji", "Mini crayfish"],
    ),
    (
        "two-scoops",
        "3382105750916",
        "2SCOOPS",
        "Dessert",
        "Clementi",
        "A NEWest spot for gelato and waffles, with sake also on the menu. An option for a sweet catch-up rather than a full dinner.",
        ["Gelato", "Waffles", "Dessert"],
        ["Gelato", "Waffles"],
    ),
    (
        "il-cielo",
        "3373869026778",
        "il Cielo",
        "Italian",
        "Orchard",
        "Rooftop Italian dining at voco Orchard, featuring house-made pasta, pizza and tiramisu with city views.",
        ["Rooftop", "Pasta", "Date night"],
        ["House-made pasta", "Pizza", "Tiramisu"],
    ),
    (
        "lime",
        "3370026024610",
        "Lime Restaurant",
        "Buffet",
        "Chinatown",
        "International and Asian buffet dining at PARKROYAL COLLECTION Pickering, with seafood, open kitchens and plant-based choices in a garden-inspired hotel.",
        ["Buffet", "Seafood", "Celebrations"],
        ["Seafood buffet", "Asian dishes", "Plant-based options"],
    ),
]


def main():
    ROOT = Path(__file__).resolve().parents[1]
    out = ROOT / "frontend/public/images/restaurants"
    out.mkdir(parents=True, exist_ok=True)
    records = []
    for slug, branch, name, cuisine, area, description, tags, dishes in VENUES:
        url = f"https://eatigo.com/en/branches/{branch}"
        html = (
            urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=40)
            .read()
            .decode()
        )
        blocks = [
            json.loads(x)
            for x in re.findall(
                r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S
            )
        ]
        venue = next(x for x in blocks if isinstance(x, dict) and x.get("geo"))
        image_url = venue["image"]
        response = urlopen(
            Request(
                quote(image_url, safe=":/?=&%"), headers={"User-Agent": "Mozilla/5.0"}
            ),
            timeout=40,
        )
        content_type = response.headers.get_content_type()
        ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/avif": ".avif",
        }[content_type]
        image = response.read()
        (out / f"{slug}{ext}").write_bytes(image)
        records.append(
            dict(
                id=slug,
                name=name,
                cuisine=cuisine,
                area=area,
                description=description,
                price=venue.get("priceRange", "$$"),
                artwork=cuisine.lower(),
                address=venue["address"]["streetAddress"],
                latitude=float(venue["geo"]["latitude"]),
                longitude=float(venue["geo"]["longitude"]),
                imagePath=f"/images/restaurants/{slug}{ext}",
                imageSource=image_url,
                sourceUrl=url,
                sourceCheckedAt="2026-09-25",
                tags=tags,
                signatureDishes=dishes,
                active=True,
            )
        )
        print(slug, len(image), "bytes")
    (ROOT / "backend/data/restaurants.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
