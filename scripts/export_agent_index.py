"""Export a small read-only public catalog for ChatGPT and other agents.

Generated from the reviewed data/catalog.json. Does not expose local edits,
secrets, or unreviewed assets. Safe to publish on GitHub raw.
"""
import argparse
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "lsy112yhu/gpt-mimibox"
BASE = f"https://raw.githubusercontent.com/{REPOSITORY}/main/public/"
MEDIA_PATH = re.compile(r"^(images|thumbnails)/[A-Za-z0-9_.-]+\.(?:png|jpg|jpeg|gif|webp)$")
CATEGORY_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
PAGE_SIZE = 24

def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

def public_url(path, prefix):
    if not isinstance(path, str) or not MEDIA_PATH.fullmatch(path) or not path.startswith(prefix + "/"):
        raise ValueError(f"Unsafe image path: {path!r}")
    return BASE + "/".join(quote(part, safe="") for part in path.split("/"))

def compact(m):
    return {
        "id": m["id"],
        "title": m.get("title", ""),
        "description": m.get("description", "")[:220],
        "categories": m.get("categories", []),
        "tags": m.get("tags", [])[:16],
        "moods": m.get("moods", [])[:8],
        "animated": bool(m.get("animated")),
        "image_url": public_url(m["file"], "images"),
        "thumbnail_url": public_url(m["thumbnail"], "thumbnails"),
        "license": m.get("license", ""),
        "sources": [
            {"pack": s.get("pack", ""), "url": s.get("url", "")}
            for s in m.get("sources", [])
        ],
    }

def export(catalog, output):
    if output.exists():
        shutil.rmtree(output)
    categories = [c for c in catalog.get("categories", []) if CATEGORY_ID.fullmatch(c["id"])]
    allowed = {c["id"] for c in categories}
    groups = defaultdict(list)
    ids = set()
    for m in catalog.get("memes", []):
        if m.get("status") != "approved" or m.get("license") in ("", "review_required", None):
            continue
        if m["id"] in ids:
            raise ValueError("Duplicate ID: " + m["id"])
        item = compact(m)
        ids.add(m["id"])
        for category in dict.fromkeys(m.get("categories", [])):
            if category in allowed:
                groups[category].append(item)
    manifest = {
        "schema_version": 1,
        "source": f"https://github.com/{REPOSITORY}",
        "total_unique": len(ids),
        "categories": [],
        "quick_url": f"https://raw.githubusercontent.com/{REPOSITORY}/main/public/agent/quick.json",
    }
    quick = []
    for category in categories:
        records = groups[category["id"]]
        if not records:
            continue
        ranked = sorted(records, key=lambda m: (len(m["description"]) < 25, not m["animated"], m["id"]))
        picks = ranked[:2]
        if len(records) > 2 and not any(not p["animated"] for p in picks):
            still = next((m for m in ranked if not m["animated"]), None)
            if still:
                picks[-1] = still
        quick.extend(picks)
        shards = []
        for start in range(0, len(records), PAGE_SIZE):
            name = f'categories/{category["id"]}-{start//PAGE_SIZE+1:02d}.json'
            write_json(output / name, {
                "schema_version": 1,
                "category": category["id"],
                "memes": records[start:start+PAGE_SIZE],
            })
            shards.append(f'https://raw.githubusercontent.com/{REPOSITORY}/main/public/agent/{name}')
        manifest["categories"].append({
            "id": category["id"],
            "name": category.get("name", category["id"]),
            "keywords": category.get("keywords", []),
            "count": len(records),
            "shards": shards,
        })
    write_json(output / "quick.json", {"schema_version": 1, "memes": quick})
    write_json(output / "index.json", manifest)
    return {
        "unique": len(ids),
        "categories": len(manifest["categories"]),
        "quick": len(quick),
        "shards": sum(len(c["shards"]) for c in manifest["categories"]),
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=ROOT / "data/catalog.json")
    parser.add_argument("--output", type=Path, default=ROOT / "public/agent")
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    print(json.dumps(export(catalog, args.output)))

if __name__ == "__main__":
    main()
