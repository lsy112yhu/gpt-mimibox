"""Tests for public read-only MimiBox index (no network requests)."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/export_agent_index.py"
spec = importlib.util.spec_from_file_location("agent_exporter", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def meme(mid, status="approved"):
    return {
        "id": mid, "title": "加油", "description": "加油庆祝一下",
        "categories": ["happy"], "tags": ["开心"], "moods": ["happy"],
        "file": f"images/{mid}.png", "thumbnail": f"thumbnails/{mid}.webp",
        "license": "CC-BY-NC-SA-4.0", "status": status, "animated": False,
        "sources": [{"pack": "sample", "url": "https://example.org/source"}],
    }

class PublicIndexTests(unittest.TestCase):
    def test_shards_links_and_quick_index(self):
        catalog = {"categories": [{"id": "happy", "name": "开心", "keywords": ["加油"]}],
                   "memes": [meme(f"m_{i:04d}") for i in range(29)]}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "agent"
            stats = mod.export(catalog, out)
            self.assertEqual(stats["unique"], 29)
            self.assertEqual(stats["shards"], 2)
            index = json.loads((out / "index.json").read_text())
            self.assertEqual(index["categories"][0]["count"], 29)
            self.assertEqual(len(index["categories"][0]["shards"]), 2)
            sample = json.loads((out / "categories/happy-01.json").read_text())["memes"]
            self.assertEqual(len(sample), 24)
            self.assertIn("/main/public/images/m_0000.png", sample[0]["image_url"])
            self.assertEqual(len(json.loads((out / "quick.json").read_text())["memes"]), 2)

    def test_unreviewed_media_not_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            payload = {"categories": [{"id": "happy"}],
                       "memes": [meme("m_0001"), meme("m_0002", "review_required")]}
            self.assertEqual(mod.export(payload, Path(tmp) / "out")["unique"], 1)

    def test_unsafe_paths_rejected(self):
        for path in ("images/../../private.png", "images/test.svg", "thumbnails/x.webp"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                mod.public_url(path, "images")

if __name__ == "__main__":
    unittest.main()
