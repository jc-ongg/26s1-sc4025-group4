# Data and asset sources

Downloaded 25 September 2026 for the SC4025 classroom prototype. Restaurant names, addresses, coordinates, price bands, dish examples and cover photos come from the linked public Eatigo branch pages. Descriptions are short original summaries. These are source snapshots, not a live Eatigo integration. No reviews or ratings were imported. All times, discounts, inventory, groups, demo identities and reservations in this application are simulated.

| Venue                           | Area        | Source                                                 |
| ------------------------------- | ----------- | ------------------------------------------------------ |
| Joya Onsen Cafe                 | Joo Koon    | [Eatigo](https://eatigo.com/en/branches/3394068428925) |
| Seorae Korean Charcoal BBQ      | Jurong East | [Eatigo](https://eatigo.com/en/branches/3370046945003) |
| Peacock North Indian Restaurant | Clementi    | [Eatigo](https://eatigo.com/en/branches/3375064665252) |
| Lazy Lizard                     | Clementi    | [Eatigo](https://eatigo.com/en/branches/3374314503596) |
| Yan Lai Ju                      | Jurong East | [Eatigo](https://eatigo.com/en/branches/3372469572815) |
| 2SCOOPS                         | Clementi    | [Eatigo](https://eatigo.com/en/branches/3382105750916) |
| il Cielo                        | Orchard     | [Eatigo](https://eatigo.com/en/branches/3373869026778) |
| Lime Restaurant                 | Chinatown   | [Eatigo](https://eatigo.com/en/branches/3370026024610) |

Exact photo URLs and venue coordinates are recorded in `backend/data/restaurants.json`. Photos are bundled in `frontend/public/images/restaurants` and served locally. `scripts/import-restaurants.py` reproduces this one-time import. Displaying these examples does not imply restaurant participation in the prototype.

## Offline map

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The local derived GeoJSON database is provided at `frontend/public/maps/singapore.geojson`, together with its notice. `scripts/import-map.py` records the extraction/conversion; it retains roads, railway, park/water geometry and place labels. It is an overview of western and central Singapore, not a navigation or routing service. Overpass downloads can time out; the checked-in extract avoids requiring another download at setup.

[Leaflet](https://leafletjs.com/reference.html) renders local vectors. There is no tile provider, API key or runtime geocoding. Restaurant coordinates come from the branch metadata. Distance filters use approximate named-area centres and great-circle distance, not travel time or walking distance.

## Embedding model

[Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2), Apache-2.0, revision `751bff37182d3f1213fa05d7196b954e230abad9`. Quantized ONNX model with 384-dimensional normalized mean-pooled embeddings. Download script: `backend/download-model.mjs`. The Docker build obtains model files once; [Transformers.js local model settings](https://huggingface.co/docs/transformers.js/custom_usage) prohibit remote model loading during runtime. [pgvector](https://github.com/pgvector/pgvector) v0.8.2 supplies cosine-distance queries inside PostgreSQL 16.

## Brand logo

Eatigo header logo downloaded from the [official website](https://eatigo.com/en/) on 25 September 2026: [original PNG](https://cdn.myfunnow.com/eatigo-web/prod/images/logo-red.png). Bundled at `frontend/public/images/brand/eatigo.png`.

Browser favicon: https://eatigo.com/favicon.ico, downloaded 25 September 2026 and served locally.
