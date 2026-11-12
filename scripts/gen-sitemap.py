#!/usr/bin/env python3
"""Generate sitemap.xml for https://moe.st/ (stdlib only).

Walks the repo for .html pages and skips:
  - 404.html and any page with <meta name="robots" content="...noindex...">
  - assets/, archive/, scripts/, .git/, .github/ and other dot folders
  - iframe-only fragments: pages whose only content is an <iframe> embedding
    another site (e.g. bio/NormalBio/index.html -> stellarprobe.com)
index.html maps to its directory URL with a trailing slash.
lastmod comes from `git log -1 --format=%cI -- <file>`.
"""
import os
import re
import subprocess
import sys
from xml.sax.saxutils import escape

BASE = "https://moe.st/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {"assets", "archive", "scripts", "node_modules"}
SKIP_FILES = {"404.html"}

NOINDEX_RE = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', re.I)
NOINDEX_RE2 = re.compile(r'<meta[^>]+content=["\'][^"\']*noindex[^"\']*["\'][^>]*name=["\']robots["\']', re.I)


def is_iframe_only(html):
    if "<iframe" not in html.lower():
        return False
    body = re.sub(r"(?is)<!--.*?-->", "", html)
    body = re.sub(r"(?is)<(script|style|iframe|title|head)[^>]*>.*?</\1>", "", body)
    text = re.sub(r"<[^>]+>", " ", body)
    return not text.strip()


def lastmod(rel):
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cI", "--", rel],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        out = ""
    return out or None


def collect():
    pages, excluded = [], []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        dirnames[:] = sorted(d for d in dirnames if not d.startswith(".") and d not in SKIP_DIRS)
        for name in sorted(filenames):
            if not name.endswith(".html"):
                continue
            rel = os.path.normpath(os.path.join(rel_dir, name)).replace(os.sep, "/")
            if name in SKIP_FILES:
                excluded.append((rel, "404 page"))
                continue
            with open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
                html = fh.read()
            if NOINDEX_RE.search(html) or NOINDEX_RE2.search(html):
                excluded.append((rel, "noindex"))
                continue
            if is_iframe_only(html):
                excluded.append((rel, "iframe-only fragment"))
                continue
            if name == "index.html":
                path = rel[: -len("index.html")]
            else:
                path = rel
            pages.append((BASE + path.lstrip("./") if path != "." else BASE, rel))
    pages.sort(key=lambda p: (p[0] != BASE, p[0]))
    return pages, excluded


def main():
    pages, excluded = collect()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, rel in pages:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(url)}</loc>")
        lm = lastmod(rel)
        if lm:
            lines.append(f"    <lastmod>{lm}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"sitemap.xml: {len(pages)} URLs", file=sys.stderr)
    for rel, why in excluded:
        print(f"  excluded {rel} ({why})", file=sys.stderr)


if __name__ == "__main__":
    main()
