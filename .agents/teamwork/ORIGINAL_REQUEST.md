# Original User Request

## Initial Request — 2026-10-22T04:39:50Z

Install and organize the requested Agent Skills collections (`andrej-karpathy-skills-main.zip`, `obra/superpowers`, `mattpocock/skills`, `affaan-m/ECC`, `anthropics/skills`), and upgrade **Bot WA Scraping 3.0 (Rima)** with LLM-ready web crawling, adaptive anti-bot scraping, structured PDF/RAG, graph context, and persistent compressed memory inspired by the 10 external reference repositories, using a native Node.js implementation with optional external API/CLI bridges.

Working directory: C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main
Integrity mode: development

Reference repositories & archives:
- Local archive: `andrej-karpathy-skills-main.zip`
- Agent Skills repositories:
  - https://github.com/obra/superpowers
  - https://github.com/mattpocock/skills
  - https://github.com/affaan-m/ECC
  - https://github.com/anthropics/skills
- Web Crawling & Adaptive Scraping repositories (Primary Priority):
  - https://github.com/firecrawl/firecrawl
  - https://github.com/unclecode/crawl4ai
  - https://github.com/D4Vinci/Scrapling
  - https://github.com/Panniantong/Agent-Reach
- PDF, RAG, Graph, Memory & Workflow repositories:
  - https://github.com/opendataloader-project/opendataloader-pdf
  - https://github.com/infiniflow/ragflow
  - https://github.com/Graphify-Labs/graphify
  - https://github.com/thedotmack/claude-mem
  - https://github.com/headroomlabs-ai/headroom
  - https://github.com/langgenius/dify

## Requirements

### R1. Agent Skills Extraction & Workspace Integration
Locate `andrej-karpathy-skills-main.zip` on the machine and fetch the skills from `obra/superpowers`, `mattpocock/skills`, `affaan-m/ECC`, and `anthropics/skills`. Install and organize them into the workspace/agent skills directory with valid `SKILL.md` frontmatter and structure so they are discoverable and ready for agent use.

### R2. Core Restoration & Project Integrity
Ensure the `Bot-Wa-Scraping-3.0-main` project in the working directory is runnable and complete (including any missing runtime modules such as job management and cache services that were previously excluded by `.gitignore`, fixing `.gitignore` rules so `src/` subdirectories are never ignored, and ensuring dependencies are installed).

### R3. LLM-Ready Web Crawling & Adaptive Scraping (Primary Feature Priority)
Upgrade the bot's web scraping and deep-scraping capabilities with native Node.js implementations plus optional external API/CLI bridges (such as Firecrawl, Jina/Agent-Reach, or Python CLI tools when configured), delivering:
- Clean LLM-ready Markdown and structured JSON extraction from web pages (stripping boilerplate, ads, and navigation noise, inspired by `firecrawl` and `crawl4ai`).
- Adaptive element matching and resilient extraction that survives minor DOM changes, with stealth/anti-bot evasion (inspired by `Scrapling` and `Agent-Reach`).
- Seamless integration into existing bot commands and natural language scraping flows.

### R4. Structured PDF/RAG, Knowledge Graph Context & Persistent Memory
Enhance the bot's document intelligence, memory, and workflow orchestration in native Node.js (with optional external bridges):
- Layout-aware PDF & document chunking/extraction for accurate RAG question-answering (inspired by `opendataloader-pdf` and `ragflow`).
- Entity/concept relationship extraction to enrich document and search context (inspired by `graphify`).
- Persistent cross-session user memory and automatic context window compression to save tokens while retaining key facts (inspired by `claude-mem` and `headroom`).
- Multi-step agentic research/scraping workflow support (inspired by `dify`).

## Verification Resources

- Existing Jest test suite in `tests/` (`npm test`).

## Acceptance Criteria

### Skills Installation
- [ ] Skills from `andrej-karpathy-skills-main.zip`, `obra/superpowers`, `mattpocock/skills`, `affaan-m/ECC`, and `anthropics/skills` are extracted/installed into the skills directory and verified to exist on disk with valid `SKILL.md` files.

### Bot Core & LLM-Ready Scraping
- [ ] All required bot modules load cleanly without `MODULE_NOT_FOUND` errors (`node -e "require('./src/bot/messageHandler')"` and job/cache modules succeed).
- [ ] Web scraping / deep scraping produces clean LLM-ready Markdown and structured JSON output from HTML content, removing boilerplate noise, verified by automated unit tests.
- [ ] Adaptive selector/element extraction and optional external bridge support (Firecrawl / Agent-Reach / CLI fallback) are covered by automated tests.

### Memory, RAG & Full Test Suite
- [ ] Persistent memory and context compression preserve conversation/document state across reloads and stay within configured token/character budgets, verified by automated tests.
- [ ] Structured PDF/RAG and knowledge-graph context enrichment pass automated unit tests.
- [ ] The full Jest test suite (`npm test`) executes and passes with 0 failures.
