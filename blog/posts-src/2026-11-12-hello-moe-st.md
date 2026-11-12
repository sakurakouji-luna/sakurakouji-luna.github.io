---
title: moe.st 随笔上线了
date: 2026-11-12
tags: [moe.st, 站点日志]
description: moe.st 的随笔栏目上线：文章用 Markdown 写，自动生成静态页面，在桌面的 Blog 窗口里阅读。
---
<!-- 示例开篇文章（starter post），可以直接改写或删除这个文件。 -->

# moe.st 随笔上线了

以前 Blog 窗口里的「随笔」一直指向 404，现在终于有内容了。

这里会放一些不成体系的短文和记录。长一点的笔记仍然在 [yuki.su](https://yuki.su/)。

## 它是怎么做的

- 文章是 `blog/posts-src/` 下的 Markdown 文件
- `scripts/build-blog.py` 把它们转成静态 HTML，样式和 moe.st 桌面保持一致
- 推送到 GitHub 后由 Actions 自动构建，并更新 sitemap

> Hello from the tiling desktop. *Thanks for reading.*
