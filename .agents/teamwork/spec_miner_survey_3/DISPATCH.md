# Dispatch for spec_miner_survey_3

## Task
Conduct specification survey for R3 & R4:
- R3: LLM-Ready Web Crawling & Adaptive Scraping (Markdown & JSON extraction, noise stripping, adaptive selectors, stealth anti-bot evasion, optional external API/CLI bridges like Firecrawl/Agent-Reach).
- R4: Structured PDF/RAG, Knowledge Graph Context & Persistent Memory (layout-aware PDF chunking, graphify-style entity relationship extraction, claude-mem/headroom persistent compressed memory, dify agentic workflow).
Inspect current bot architecture and define detailed module contracts, interface designs, and test requirements.

## Reference
- ORIGINAL_REQUEST.md path: `C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\ORIGINAL_REQUEST.md`

## Output
Write detailed specification to `C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\teamwork\spec_miner_survey_3\spec.md` and complete handoff report to `handoff.md`.

## 2026-10-22T04:43:53Z
Investigate & specify:
1. R3 requirements:
   - Clean LLM-ready Markdown and structured JSON extraction from web pages (stripping boilerplate, ads, navigation noise, inspired by firecrawl and crawl4ai).
   - Adaptive element matching and resilient extraction that survives minor DOM changes, with stealth/anti-bot evasion (inspired by Scrapling and Agent-Reach).
   - Seamless integration into bot commands and natural language scraping flows.
   - Native Node.js architecture with optional external API/CLI bridges (Firecrawl, Jina/Agent-Reach, Python CLI tools).
2. R4 requirements:
   - Layout-aware PDF & document chunking/extraction for accurate RAG Q&A (inspired by opendataloader-pdf and ragflow).
   - Entity/concept relationship extraction for document and search context (inspired by graphify).
   - Persistent cross-session user memory and automatic context window compression (inspired by claude-mem and headroom).
   - Multi-step agentic research/scraping workflow support (inspired by dify).
3. Design module interfaces, method signatures, file locations in src/, and testability strategies.
4. Output requirements: Write your detailed specification to spec.md in your working directory and a complete handoff report to handoff.md. Keep progress.md updated with your heartbeat. When finished, send a message to the orchestrator.
