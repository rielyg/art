# Paper Mosaic

Generative art from a citation record. Each week a GitHub Action pulls citation counts from OpenAlex, draws a new mosaic, saves it to the gallery, and publishes the site to GitHub Pages.

## How the image encodes the data

- Each cell is one paper (the 200 most cited, configurable). Cell area scales with total citations.
- Hue follows publication year. The whole palette rotates a little each week.
- A starburst marks a paper that gained citations since the last run, one ray per new citation. This layer starts after the second weekly run, once there is a previous snapshot to compare against.
- Randomness: the cell layout, color jitter and gradient direction come from a random number generator seeded with the snapshot date and total citation count. Each week's image is unique, and any past image can be regenerated exactly.

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

## Running locally

```
python scripts/fetch_openalex.py
npm install --no-save playwright && npx playwright install chromium
node scripts/render.mjs --size 2400          # real image
node scripts/render.mjs --size 2400 --demo   # simulated weekly citations
python -m http.server -d site 8000           # then open http://localhost:8000
```

Add `?seed=anything` to the page URL to see other random layouts of the same data.
