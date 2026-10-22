---
name: headroom
description: Context optimization and Smart Crushing layer for LLM applications. Compresses JSON scrape arrays, long documents, and multi-turn chat histories by 40-80% tokens.
---

# Headroom — Smart Crushing & Context Token Optimization

Reference Repository: https://github.com/headroomlabs-ai/headroom  
Native Bot Module: `src/services/compression/contextCompressor.js` (`compressJsonItems`, `compressText`, `compressMessages`)  
Bot Command: `!memory compress <jobId|text>`

## Capabilities
- **Smart Crusher**: Deduplicates repetitive JSON keys across scraped item arrays and removes null/boilerplate fields.
- **Content-Aware Text Compressor**: Preserves Markdown headings, tables, citations, and numeric sentences while reducing token count to a target ratio.
- **Rolling Conversation Compression**: Summarizes older chat turns while keeping recent turns and system instructions intact.
