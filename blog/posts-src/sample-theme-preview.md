---
title: 夜空下的平铺桌面（主题样例）
date: 2026-11-12
tags: [sample]
description: Markdown 主题样例，用于检查标题、列表、引用、表格、代码和图片的样式。
draft: true
---
# 夜空下的平铺桌面 · Tiling Under the Night Sky

> 这是一篇示例文章，用来对比不同 Markdown 主题在 moe.st 博客窗口里的效果。
> *A sample post to compare Markdown themes inside the moe.st blog window.*

## 为什么要自己写 md2html

moe.st 是一个纯静态站点，没有框架。博客文章用 **Markdown** 写，再转成静态 HTML，放进桌面里的 `Blog` 窗口。这样既能被搜索引擎收录，又能保持 *终端风* 的外观。

### 这次要比较的东西

- 标题层级和配色是否和夜空壁纸搭
- 代码块的语法高亮是否清晰
- 表格、引用、图片的细节
  - 嵌套列表也要看一眼
- 中英文混排 / mixed CJK and Latin text

1. 写 Markdown
2. 跑转换脚本
3. 推到 GitHub Pages

## 一段代码 · Some Code

```python
from pathlib import Path
import markdown

def build(src: Path, out: Path) -> None:
    """Convert every post to static HTML."""
    for md in sorted(src.glob("*.md")):
        html = markdown.markdown(md.read_text("utf-8"), extensions=["fenced_code", "tables"])
        (out / f"{md.stem}.html").write_text(html, encoding="utf-8")
        print(f"built {md.name} -> {len(html)} bytes")

build(Path("posts"), Path("blog"))
```

行内代码像这样：`python3 scripts/gen-sitemap.py`。

## 一张表格 · A Table

| 主题 Theme | 风格 Vibe | 许可证 License |
| :--- | :---: | ---: |
| Cyberpunk | 霓虹发光 | MIT |
| Dracula | 经典暗紫 | MIT |
| Terminal | 等宽终端 | MIT |

## 一张图片 · An Image

![BD8AFN QSL 卡片](/radio/img/qsl.jpg)

---

更多内容见 [slchy.com](https://slchy.com/)、[yuki.su](https://yuki.su/) 以及 GitHub 上的 [小米 AI 眼镜自定义 Agent SDK](https://github.com/slchy/xiaomi-ai-glasses2grok-and-so-on)。Thanks for reading!
