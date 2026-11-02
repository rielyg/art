"""Fetch an author's works from OpenAlex and write site/data/papers.json.

Keeps one snapshot of citation counts per run in data/snapshots/ so the
next run can compute how many citations each paper gained since last week.

Environment variables (all optional):
  OPENALEX_AUTHOR   OpenAlex author ID (default A5060033755)
  OPENALEX_API_KEY  OpenAlex API key, if your usage needs one
  OPENALEX_MAILTO   contact email for the OpenAlex polite pool
  MOSAIC_TOP_N      number of most-cited works to include (default 200)
"""
import datetime as dt
import json
import os
import pathlib
import urllib.parse
import urllib.request

AUTHOR = os.environ.get("OPENALEX_AUTHOR", "A5060033755")
TOP_N = int(os.environ.get("MOSAIC_TOP_N", "200"))
SKIP_TYPES = {"erratum", "paratext", "retraction", "peer-review"}

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "papers.json"
SNAP_DIR = ROOT / "data" / "snapshots"


def get(url, params):
    if os.environ.get("OPENALEX_API_KEY"):
        params["api_key"] = os.environ["OPENALEX_API_KEY"]
    if os.environ.get("OPENALEX_MAILTO"):
        params["mailto"] = os.environ["OPENALEX_MAILTO"]
    full = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(full, headers={"User-Agent": "paper-mosaic"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def group_for(topic):
    name = (topic or {}).get("display_name", "")
    if name in ("Lung Cancer Treatments and Mutations",):
        return "L"
    if name in ("Lung Cancer Diagnosis and Treatment", "Lung Cancer Research Studies"):
        return "D"
    if "Genomics" in name:
        return "G"
    if "Immunotherapy" in name:
        return "I"
    return "O"


def fetch_all_works():
    works, cursor = [], "*"
    while cursor:
        page = get(
            "https://api.openalex.org/works",
            {
                "filter": f"authorships.author.id:{AUTHOR},is_retracted:false",
                "select": "id,publication_year,cited_by_count,primary_topic,type",
                "per-page": "200",
                "cursor": cursor,
            },
        )
        works.extend(page["results"])
        cursor = page["meta"].get("next_cursor")
        if not page["results"]:
            break
    return works


def latest_snapshot():
    snaps = sorted(SNAP_DIR.glob("*.json"))
    return json.loads(snaps[-1].read_text()) if snaps else {}


def main():
    today = dt.date.today().isoformat()
    author = get(f"https://api.openalex.org/authors/{AUTHOR}", {})
    works = [w for w in fetch_all_works() if w.get("type") not in SKIP_TYPES]
    works.sort(key=lambda w: w["cited_by_count"], reverse=True)

    prev = latest_snapshot()
    counts = {w["id"].rsplit("/", 1)[-1]: w["cited_by_count"] for w in works}

    rows = []
    for w in works[:TOP_N]:
        wid = w["id"].rsplit("/", 1)[-1]
        fresh = max(0, counts[wid] - prev[wid]) if wid in prev else 0
        rows.append([wid, w.get("publication_year") or 0, w["cited_by_count"], group_for(w.get("primary_topic")), fresh])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "author_id": AUTHOR,
        "author_name": author.get("display_name", ""),
        "snapshot_date": today,
        "total_citations": author.get("cited_by_count", 0),
        "works_count": author.get("works_count", 0),
        "new_citations_this_week": sum(r[4] for r in rows),
        "fields": ["id", "year", "cites", "group", "new_this_week"],
        "works": rows,
    }, indent=0))

    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    (SNAP_DIR / f"{today}.json").write_text(json.dumps(counts))
    print(f"{len(rows)} works, {sum(r[4] for r in rows)} new citations since last snapshot")


if __name__ == "__main__":
    main()
