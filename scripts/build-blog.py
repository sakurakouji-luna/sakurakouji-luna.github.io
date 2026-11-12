#!/usr/bin/env python3
"""Build moe.st essays (随笔) from blog/posts-src/*.md into static HTML.

Output (fully generated, safe to delete and rebuild):
  blog/essays/index.html            post list
  blog/essays/<slug>/index.html     one page per post
  assets/blog/moe-pygments.css      code highlight colours (moe.st palette)
Source posts: blog/posts-src/*.md with a front matter block:
  ---
  title: 标题
  date: 2026-11-12
  tags: [moe.st, notes]
  description: 一句话简介
  slug: optional-custom-slug
  updated: 2026-11-13      (optional)
  draft: true              (optional, skipped)
  ---
Files whose name starts with "_" are ignored too.
Requires: pip install -r scripts/requirements-blog.txt
"""
import datetime as dt
import html
import json
import pathlib
import re
import shutil
import sys

import markdown
from pygments.formatters import HtmlFormatter
from pygments.style import Style
from pygments.token import (Comment, Error, Generic, Keyword, Literal, Name,
                            Number, Operator, Punctuation, String, Text)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "blog" / "posts-src"
OUT = ROOT / "blog" / "essays"
ASSETS = ROOT / "assets" / "blog"
BASE = "https://moe.st"
SITE_NAME = "slchy · moe.st"
AUTHOR = "slchy"
OG_IMAGE = "https://cdn.jsdelivr.net/gh/sakurakouji-luna/pic@main/web/avatar/web_ico_runa.ico"
FAVICON = OG_IMAGE
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

ANALYTICS = """    <script async src="https://www.googletagmanager.com/gtag/js?id=G-3HN1RG37FH"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-3HN1RG37FH');
    </script>
    <script>
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "lrrfwkrqdv");
    </script>"""


class MoeStyle(Style):
    """Pygments colours taken from :root in assets/desktop/styles.css."""
    name = "moe"
    background_color = "#090b09"
    highlight_color = "#22261f"
    styles = {
        Text: "#dcebd1",
        Comment: "italic #9da796",
        Keyword: "bold #a7d46f",
        Keyword.Constant: "#ffb454",
        Keyword.Type: "#76d1c7",
        Operator: "#edf1e8",
        Operator.Word: "bold #a7d46f",
        Punctuation: "#9da796",
        Name: "#edf1e8",
        Name.Builtin: "#76d1c7",
        Name.Function: "#76d1c7",
        Name.Class: "bold #76d1c7",
        Name.Decorator: "#ffb454",
        Name.Namespace: "#7fbd4c",
        String: "#ffb454",
        String.Doc: "italic #9da796",
        String.Interpol: "#a7d46f",
        String.Escape: "#ff9b8f",
        Number: "#ff9b8f",
        Literal: "#ff9b8f",
        Generic.Deleted: "#ff6b5f",
        Generic.Inserted: "#a7d46f",
        Generic.Heading: "bold #a7d46f",
        Error: "#ff6b5f",
    }


def esc(value):
    return html.escape(str(value), quote=True)


def parse_front_matter(text, path):
    if not text.startswith("---"):
        raise SystemExit(f"{path}: missing front matter")
    parts = text.split("\n")
    end = next((i for i in range(1, len(parts)) if parts[i].strip() == "---"), None)
    if end is None:
        raise SystemExit(f"{path}: unterminated front matter")
    meta = {}
    for line in parts[1:end]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, sep, value = line.partition(":")
        if not sep:
            raise SystemExit(f"{path}: bad front matter line: {line!r}")
        key, value = key.strip().lower(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key == "tags":
            value = [t.strip().strip("\"'") for t in value.strip("[]").split(",") if t.strip()]
        elif key == "draft":
            value = value.lower() in ("true", "yes", "1")
        meta[key] = value
    return meta, "\n".join(parts[end + 1:])


def to_date(value, path, field):
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except ValueError:
        raise SystemExit(f"{path}: {field} must be YYYY-MM-DD")


def render_markdown(body):
    langs = []
    for m in re.finditer(r"^(```+|~~~+)\s*([\w+-]*)[^\n]*\n.*?^\1\s*$", body, re.M | re.S):
        langs.append(m.group(2) or "text")
    out = markdown.markdown(
        body,
        extensions=["fenced_code", "tables", "codehilite", "sane_lists", "toc"],
        extension_configs={"codehilite": {"css_class": "highlight", "guess_lang": False}},
        output_format="html5",
    )
    it = iter(langs)

    def wrap(m):
        lang = esc(next(it, "text"))
        return f'<figure class="code-window"><figcaption>{lang}</figcaption>{m.group(0)}</figure>'

    return re.sub(r'<div class="highlight"><pre>.*?</pre></div>', wrap, out, flags=re.S)


def ld_json(data):
    return json.dumps(data, ensure_ascii=False, indent=2).replace("</", "<\\/")


def page(*, title, description, canonical, og_type, ld, body):
    return f"""<!DOCTYPE html>
<!-- generated by scripts/build-blog.py — edit blog/posts-src/*.md instead -->
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}">
    <link rel="canonical" href="{esc(canonical)}">
    <meta property="og:type" content="{og_type}">
    <meta property="og:site_name" content="moe.st">
    <meta property="og:title" content="{esc(title)}">
    <meta property="og:description" content="{esc(description)}">
    <meta property="og:url" content="{esc(canonical)}">
    <meta property="og:image" content="{OG_IMAGE}">
    <meta property="og:locale" content="zh_CN">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="{esc(title)}">
    <meta name="twitter:description" content="{esc(description)}">
    <meta name="twitter:image" content="{OG_IMAGE}">
    <link rel="shortcut icon" type="image/x-icon" href="{FAVICON}">
    <link rel="stylesheet" href="/assets/blog/moe-blog.css">
    <link rel="stylesheet" href="/assets/blog/moe-pygments.css">
    <script type="application/ld+json">
{ld_json(ld)}
    </script>
{ANALYTICS}
  </head>
  <body>
    <article class="moe-post">
{body}
    </article>
  </body>
</html>
"""


def crumbs(*items):
    links = ['<a href="/" target="_top">slchy_routingspace</a>', '<a href="/blog/">blog</a>']
    links += list(items)
    return '      <nav class="crumbs" aria-label="breadcrumb">' + " / ".join(links) + "</nav>"


def meta_line(post):
    bits = [f'<time datetime="{post["date"].isoformat()}">{post["date"].isoformat()}</time>', esc(AUTHOR)]
    if post["tags"]:
        bits.append(" ".join(f"#{esc(t)}" for t in post["tags"]))
    return '<div class="post-meta">' + '<span class="sep">|</span>'.join(bits) + "</div>"


def load_posts():
    posts, skipped = [], []
    for path in sorted(SRC.glob("*.md")):
        if path.name.startswith("_"):
            skipped.append((path.name, "underscore"))
            continue
        meta, body = parse_front_matter(path.read_text("utf-8"), path)
        if meta.get("draft"):
            skipped.append((path.name, "draft"))
            continue
        for field in ("title", "date", "description"):
            if not meta.get(field):
                raise SystemExit(f"{path}: front matter needs {field}")
        slug = meta.get("slug") or re.sub(r"^\d{4}-\d{2}-\d{2}-", "", path.stem)
        if not SLUG_RE.match(slug):
            raise SystemExit(f"{path}: slug {slug!r} must be lowercase a-z, 0-9 and '-'")
        date = to_date(meta["date"], path, "date")
        updated = to_date(meta["updated"], path, "updated") if meta.get("updated") else date
        posts.append({
            "slug": slug, "title": meta["title"], "date": date, "updated": updated,
            "tags": meta.get("tags") or [], "description": meta["description"],
            "html": render_markdown(body), "src": path.name,
        })
    slugs = [p["slug"] for p in posts]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        raise SystemExit(f"duplicate slugs: {sorted(dupes)}")
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return posts, skipped


def build_post(post):
    url = f"{BASE}/blog/essays/{post['slug']}/"
    deep = f"/?app=blog&amp;path=/blog/essays/{post['slug']}/"
    ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["title"],
        "description": post["description"],
        "datePublished": post["date"].isoformat(),
        "dateModified": post["updated"].isoformat(),
        "inLanguage": "zh-CN",
        "url": url,
        "mainEntityOfPage": url,
        "keywords": post["tags"],
        "author": {"@type": "Person", "name": AUTHOR, "url": f"{BASE}/"},
        "publisher": {"@type": "Person", "name": AUTHOR, "url": f"{BASE}/"},
        "isPartOf": {"@type": "Blog", "name": "slchy 随笔", "url": f"{BASE}/blog/essays/"},
    }
    content = post["html"]
    # the first H1 in the markdown is replaced by the front-matter title
    content = re.sub(r"^((?:\s*<!--.*?-->)*)\s*<h1[^>]*>.*?</h1>\s*", r"\1\n", content, count=1, flags=re.S)
    body = "\n".join([
        crumbs('<a href="/blog/essays/">essays</a>'),
        f"      <h1>{esc(post['title'])}</h1>",
        "      " + meta_line(post),
        content,
        f'      <footer class="post-foot"><a href="/blog/essays/">← 随笔列表</a>'
        f'<span class="sep"> | </span><a href="{deep}" target="_top">在 moe.st 桌面中打开</a></footer>',
    ])
    return page(title=f"{post['title']} · slchy 随笔", description=post["description"],
                canonical=url, og_type="article", ld=ld, body=body)


def build_index(posts):
    url = f"{BASE}/blog/essays/"
    items = []
    for p in posts:
        tags = " ".join(f"#{esc(t)}" for t in p["tags"])
        items.append(
            f'        <li><a class="post-card" href="/blog/essays/{p["slug"]}/">'
            f'<span class="post-card-title">{esc(p["title"])}</span>'
            f'<span class="post-card-meta"><time datetime="{p["date"].isoformat()}">{p["date"].isoformat()}</time>'
            + (f' · {tags}' if tags else "") + "</span>"
            f'<span class="post-card-desc">{esc(p["description"])}</span></a></li>'
        )
    listing = ("      <ul class=\"post-list\">\n" + "\n".join(items) + "\n      </ul>") if items else \
        '      <p class="post-empty">还没有文章。</p>'
    ld = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "slchy 随笔",
        "url": url,
        "inLanguage": "zh-CN",
        "author": {"@type": "Person", "name": AUTHOR, "url": f"{BASE}/"},
        "blogPost": [{"@type": "BlogPosting", "headline": p["title"],
                      "url": f"{BASE}/blog/essays/{p['slug']}/",
                      "datePublished": p["date"].isoformat()} for p in posts],
    }
    body = "\n".join([
        crumbs('<a href="/blog/essays/">essays</a>'),
        "      <h1>随笔 · Essays</h1>",
        f'      <div class="post-meta">{len(posts)} 篇<span class="sep">|</span>{esc(AUTHOR)}'
        '<span class="sep">|</span>Markdown → 静态 HTML</div>',
        listing,
    ])
    return page(title="随笔 · slchy · moe.st",
                description="slchy 的随笔：在 moe.st 平铺桌面里用 Markdown 写的短文与记录。",
                canonical=url, og_type="website", ld=ld, body=body)


def main():
    posts, skipped = load_posts()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for post in posts:
        target = OUT / post["slug"]
        target.mkdir()
        (target / "index.html").write_text(build_post(post), "utf-8")
    (OUT / "index.html").write_text(build_index(posts), "utf-8")
    ASSETS.mkdir(parents=True, exist_ok=True)
    css = "/* generated by scripts/build-blog.py (MoeStyle) */\n" + HtmlFormatter(style=MoeStyle).get_style_defs(".highlight") + "\n"
    (ASSETS / "moe-pygments.css").write_text(css, "utf-8")
    print(f"built {len(posts)} post(s) -> blog/essays/", file=sys.stderr)
    for p in posts:
        print(f"  /blog/essays/{p['slug']}/  <- {p['src']}", file=sys.stderr)
    for name, why in skipped:
        print(f"  skipped {name} ({why})", file=sys.stderr)


if __name__ == "__main__":
    main()
