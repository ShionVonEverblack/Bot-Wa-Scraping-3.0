---
name: agent-reach
description: Give your AI Agent eyes to see the entire internet. Multi-platform web and social reader supporting zero-key Jina Reader (r.jina.ai) and multi-provider routing.
---

# Agent-Reach — Universal Internet Reader for AI Agents

Reference Repository: https://github.com/Panniantong/Agent-Reach  
Native Bot Module: `src/engine/llmCrawler.js` (`bridge: 'jina'`), `src/engine/providers/general/webreader.provider.js`  
Bot Command: `!crawl <url> --bridge jina`

## Capabilities
- Zero-API-key web reading via `r.jina.ai` bridge with automatic fallback to native adaptive scraping.
- Unified multi-platform extraction across web pages, Reddit forums, YouTube transcripts, and academic repositories.
