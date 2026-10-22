---
name: crawl4ai
description: Open-source LLM-friendly web crawler and scraper generating Fit-Markdown (boilerplate-pruned main content), numbered citations, and GFM tables.
---

# Crawl4AI — Fit-Markdown & Citation Extraction

Reference Repository: https://github.com/unclecode/crawl4ai  
Native Bot Module: `src/engine/llmCrawler.js` (`htmlToMarkdown`, `findMainContentContainer`)  
Bot Command: `!crawl <url> --format md`

## Capabilities
- **Fit-Markdown Heuristic**: Prunes navbars, footers, ads, cookie banners, and sidebars, isolating the highest text-density content container.
- **Numbered Citations**: Converts links into numbered reference footers (`[1]: https://...`).
- **Table Extraction**: Converts HTML `<table>` structures into clean Markdown tables.
