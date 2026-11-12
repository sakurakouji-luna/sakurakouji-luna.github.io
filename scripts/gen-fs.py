#!/usr/bin/env python3
"""Generate fs.json, the read-only file tree behind the terminal's ls/cd/cat/tree.

Reuses gen-sitemap.py's git lastmod helper. Skips dot folders (.git, .github),
scripts/, archive/, node_modules/, fs.json itself, and binaries over 512 KiB.
Format: {"v":1,"root":{"t":"d","c":{"name":{"t":"f","s":bytes,"m":"ISO time"},...}}}
"""
import datetime as dt
import importlib.util
import json
import os
import sys

sys.dont_write_bytecode = True  # importing gen-sitemap.py must not leave __pycache__ in the repo
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("gen_sitemap", os.path.join(ROOT, "scripts", "gen-sitemap.py"))
gen_sitemap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen_sitemap)

SKIP_DIRS = {"scripts", "archive", "node_modules"}
SKIP_FILES = {"fs.json"}
TEXT_EXT = {".md", ".txt", ".html", ".xml", ".css", ".js", ".json", ".yml", ".svg"}
MAX_BINARY = 512 * 1024


def build():
    root = {"t": "d", "c": {}}
    skipped = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        dirnames[:] = sorted(d for d in dirnames if not d.startswith(".") and d not in SKIP_DIRS)
        node = root
        if rel_dir != ".":
            for part in rel_dir.split(os.sep):
                node = node["c"].setdefault(part, {"t": "d", "c": {}})
        for name in sorted(filenames):
            rel = os.path.normpath(os.path.join(rel_dir, name)).replace(os.sep, "/")
            if name.startswith(".") or name in SKIP_FILES and rel_dir == ".":
                continue
            size = os.path.getsize(os.path.join(ROOT, rel))
            if os.path.splitext(name)[1].lower() not in TEXT_EXT and size > MAX_BINARY:
                skipped.append((rel, size))
                continue
            entry = {"t": "f", "s": size}
            mtime = gen_sitemap.lastmod(rel)
            if mtime:
                entry["m"] = mtime
            node["c"][name] = entry
    prune(root)
    return root, skipped


def prune(node):
    """Drop empty directories; a directory's mtime is its newest child's."""
    for name in list(node["c"]):
        child = node["c"][name]
        if child["t"] == "d":
            prune(child)
            if not child["c"]:
                del node["c"][name]
    times = [child["m"] for child in node["c"].values() if child.get("m")]
    if times:
        node["m"] = max(times, key=lambda value: dt.datetime.fromisoformat(value))


def main():
    root, skipped = build()
    data = json.dumps({"v": 1, "root": root}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    with open(os.path.join(ROOT, "fs.json"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(data + "\n")
    print(f"fs.json: {len(data) + 1} bytes", file=sys.stderr)
    for rel, size in skipped:
        print(f"  skipped {rel} ({size} bytes binary)", file=sys.stderr)


if __name__ == "__main__":
    main()
