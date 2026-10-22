---
name: scrapling
description: Adaptive web scraping framework that learns DOM element signatures and automatically relocates elements when websites redesign their layout or CSS classes, with anti-bot stealth headers.
---

# Scrapling — Adaptive Element Relocation & Stealth Scraping

Reference Repository: https://github.com/D4Vinci/Scrapling  
Native Bot Module: `src/engine/adaptiveScraper.js` (`buildElementSignature`, `relocateElement`, `adaptiveExtract`, `getStealthHeaders`)  
Bot Command: `!crawl <url> --selector "<css>"` or `!customscrape <url> --selector "<css>"`

## Capabilities
- **Self-Healing Selectors**: Computes a multi-dimensional fingerprint (tag, semantic attributes, class tokens, text tokens, parent/child structure) and relocates elements by weighted similarity when CSS selectors break.
- **Stealth Headers**: Generates realistic browser `Sec-CH-UA`, `Sec-Fetch-*`, and `Referer` header profiles.
