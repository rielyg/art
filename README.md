# Paper Mosaic

Generative art from Gregory J. Riely's citation record. Each week a GitHub Action pulls citation counts from OpenAlex, draws a new mosaic, saves it to the gallery, and publishes the site to GitHub Pages.

## How the image encodes the data

- Each cell is one paper (the 200 most cited, configurable). Cell area scales with total citations.
- Thick borders separate five-year eras of publication.
- Hue follows publication year. The whole palette rotates a little each week.
- Pattern marks the OpenAlex primary topic: solid for lung cancer treatment and mutation papers, stripes for diagnosis, pathology and guidelines, dots for genomics, rings for immunotherapy, crosshatch for other topics.
- A starburst marks a paper that gained citations since the last run, one ray per new citation. This layer starts after the second weekly run, once there is a previous snapshot to compare against.
- Randomness: the cell layout, color jitter, gradient direction and pattern angles come from a random number generator seeded with the snapshot date and total citation count. Each week's image is unique, and any past image can be regenerated exactly.

## Layout

```
site/                  published to GitHub Pages
  index.html           interactive page (hover for details, click opens OpenAlex)
  gallery.html         all past weeks
  mosaic.js            drawing code, shared by the page and the renderer
  vendor/              d3, d3-voronoi-treemap, seedrandom
  data/papers.json     current data
  images/              weekly PNGs, latest.png, index.json
data/snapshots/        one citation-count snapshot per run
scripts/
  fetch_openalex.py    OpenAlex -> site/data/papers.json
  render.mjs           headless Chromium -> PNG
.github/workflows/weekly.yml
```

## Setup

1. Create a GitHub repository and push this folder to it.
2. Settings > Pages > Build and deployment > Source: GitHub Actions.
3. Optional: Settings > Secrets and variables > Actions. Add `OPENALEX_MAILTO` (your email, for the OpenAlex polite pool) and `OPENALEX_API_KEY` if your OpenAlex usage needs a key.
4. Actions tab > Weekly mosaic > Run workflow, to produce the first image without waiting for Monday.

## Running locally

```
python scripts/fetch_openalex.py
npm install --no-save playwright && npx playwright install chromium
node scripts/render.mjs --size 2400          # real image
node scripts/render.mjs --size 2400 --demo   # simulated weekly citations
python -m http.server -d site 8000           # then open http://localhost:8000
```

Add `?seed=anything` to the page URL to see other random layouts of the same data.
