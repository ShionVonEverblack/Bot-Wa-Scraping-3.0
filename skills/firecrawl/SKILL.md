---
name: firecrawl
description: Turn entire websites into LLM-ready markdown or structured data. Crawls single URLs or multi-page sites with boilerplate removal and optional Firecrawl v1 API bridge.
---

# Firecrawl — LLM-Ready Web Crawling

Reference Repository: https://github.com/firecrawl/firecrawl  
Native Bot Module: `src/engine/llmCrawler.js` (`scrapeUrlToMarkdown`, `crawlSite`)  
Bot Command: `!crawl <url> [--depth N] [--max N] [--bridge firecrawl|native]`

## Capabilities
- Converts complex HTML pages into clean, structured GitHub-Flavored Markdown.
- Crawls internal links across a domain up to `maxPages` and `maxDepth`.
- Supports optional `FIRECRAWL_API_KEY` bridge to `https://api.firecrawl.dev/v1/scrape` with automatic native Node.js fallback.
