# Handoff Report: Specification Survey for R3 & R4 Upgrades

**Agent:** spec_miner_survey_3  
**Role:** Specification Miner  
**Working Directory:** `C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\teamwork\spec_miner_survey_3`  
**Target Specification:** `spec.md`  
**Timestamp:** 2026-10-22T04:54:00Z  

---

## 1. Observation

1. **Original Request**:
   - `ORIGINAL_REQUEST.md` lines 38-49:
     - "R3. LLM-Ready Web Crawling & Adaptive Scraping (Primary Feature Priority): Upgrade the bot's web scraping and deep-scraping capabilities with native Node.js implementations plus optional external API/CLI bridges (such as Firecrawl, Jina/Agent-Reach, or Python CLI tools when configured)..."
     - "R4. Structured PDF/RAG, Knowledge Graph Context & Persistent Memory: Enhance the bot's document intelligence, memory, and workflow orchestration in native Node.js (with optional external bridges)..."
2. **Current Scraping Architecture**:
   - `src/engine/deepScraper.js` lines 81-202: uses Puppeteer page evaluation to extract title, description, headings (`h1-h6`), paragraphs, images, links, tables, and JSON-LD. However, it lacks boilerplate noise stripping, readability score filtering, and semantic Markdown generation.
   - `src/engine/browserPool.js` lines 16-32: maintains singleton Brave browser instance with user-agent and viewport rotation, but lacks evasion protections (e.g. `navigator.webdriver` masking, plugin spoofing, canvas/webgl noise injection, Cloudflare challenge detection).
   - `src/commands/handlers/customscrape.handler.js` lines 20-63: expects a rigid CSS selector (`--selector <css>`). If target site classes change, the command returns zero results without fallback or self-healing.
3. **Current Memory & Document Architecture**:
   - `src/bot/nlp/contextMemory.js` lines 33-35: in-memory `Map()`, 30-minute TTL, max 20 messages (`MAX_HISTORY = 20`), lost completely upon bot reboot.
   - `src/bot/messageHandler.js` lines 277-279: checks `if (userContext?.lastDocumentText)`, showing prior intent for document Q&A, but `lastDocumentText` is never populated from PDFs or web crawls.
   - `package.json` line 31: `pdf-parse: "^2.4.5"` is present in dependencies, but grep search across `src/` revealed 0 usages.
4. **Current Test Suite Verification**:
   - Running `npx jest --testPathIgnorePatterns="skills"` executes 14 test suites and 187 tests with 0 failures:
     ```
     Test Suites: 14 passed, 14 total
     Tests:       187 passed, 187 total
     Snapshots:   0 total
     Time:        7.902 s
     Ran all test suites.
     ```
   - Running bare `npm test` encounters Jest matching against `skills/superpowers/tests/brainstorm-server/` which are written for node's built-in test runner rather than Jest.

---

## 2. Logic Chain

1. **Bridging User Expectations with Native Reliability**:
   - From Observation 1, the user requested upgrades inspired by 10 specific repositories: `firecrawl`, `crawl4ai`, `Scrapling`, `Agent-Reach` (for R3), and `opendataloader-pdf`, `ragflow`, `graphify`, `claude-mem`, `headroom`, `dify` (for R4).
   - Because the target deployment is a WhatsApp bot running on Node.js, requiring external microservices or mandatory API keys for basic operations would introduce failure points.
   - Therefore, all 8 core capabilities are architected in native Node.js (Cheerio + Puppeteer + custom algorithms), with optional external bridges cascading in priority order (`Native Stealth -> Agent-Reach / Jina Reader -> Firecrawl API -> Python CLI`).
2. **Noise Stripping & LLM Markdown Extraction (R3)**:
   - From Observation 2, `deepScraper.js` produces messy unstructured paragraph arrays.
   - Inspired by `firecrawl` and `crawl4ai`, `markdownConverter.js` introduces heuristic content cleaning (removing nav, ads, cookie banners, modals, tracking scripts, and computing text-density scores) and emits token-dense GFM Markdown.
3. **Adaptive Resilience & Stealth (R3)**:
   - From Observation 2, rigid selectors break on modern websites that re-hash CSS class names.
   - Inspired by `Scrapling`, `adaptiveSelector.js` computes a multi-attribute element signature (tag, attributes, text pattern, tree path, landmark anchors) and scores candidates with a similarity algorithm, persisting healed selectors to `resilientStore.js`.
   - `stealthEngine.js` injects evasion scripts to defeat bot detection and identify Cloudflare Turnstile screens.
4. **Layout-Aware PDF & Hybrid RAG (R4)**:
   - From Observation 3, `pdf-parse` is installed but unused.
   - Inspired by `opendataloader-pdf` and `ragflow`, `layoutPdfParser.js` removes running headers/footers, reconstructs multi-column reading order, and parses table grids into Markdown tables.
   - `documentChunker.js` injects hierarchical breadcrumbs (`[Doc > Section > Page]`) into chunks so semantic context is never lost.
   - `documentRagEngine.js` provides zero-external-dependency local retrieval using BM25 lexical scoring and token-cosine similarity with Reciprocal Rank Fusion.
5. **Knowledge Graph & Persistent Memory (R4)**:
   - Inspired by `graphify`, `knowledgeGraph.js` extracts entity-relation triples and enables 1-hop / 2-hop context expansion during user queries, plus Mermaid diagram generation for WhatsApp chat.
   - Inspired by `claude-mem` and `headroom`, `layeredMemoryManager.js` and `persistentMemoryStore.js` replace the ephemeral `contextMemory.js` Map with file-backed JSON storage across 3 layers (Working, Semantic Profile, Episodic) and compress token windows via rolling summaries.
6. **Multi-Step Agentic Research (R4)**:
   - Inspired by `dify`, `researchWorkflowEngine.js` orchestrates multi-step research DAGs with checkpointed state on disk and incremental progress updates to WhatsApp.

---

## 3. Caveats

1. **Puppeteer Headless Environment**: On machines without Brave or Chrome installed, native browser-based scraping will fail; however, our cascading bridge design automatically falls back to Jina Reader (`r.jina.ai`) or Cheerio HTTP fetch.
2. **Scanned PDFs**: Layout PDF parsing relies on text-layer positioning. For purely scanned/image PDFs, OCR integration (`tesseract.js` or AI vision via `aiService.analyzeImage`) is recommended and specified in the edge cases.
3. **External API Keys**: Firecrawl API and external LLMs require API keys. If keys are missing, the architecture operates purely on native heuristics and local rule-based models.

---

## 4. Conclusion

A comprehensive, production-grade specification for R3 and R4 has been drafted and saved to `spec.md`. The design cleanly extends Bot WA Scraping 3.0 without breaking existing command handlers, providers, or the 187 existing unit tests. The modular separation in `src/engine/crawler/`, `src/services/document/`, `src/services/graph/`, `src/services/memory/`, and `src/services/workflow/` provides a concrete, step-by-step roadmap for implementation agents.

---

## 5. Verification Method

To independently verify the specification and architecture:
1. **Inspect Specification Artifact**:
   - Open and review `C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\teamwork\spec_miner_survey_3\spec.md`.
   - Verify all 29 discovered features in the Features Discovered table.
   - Verify all 17 edge cases and handling strategies.
   - Check module interface signatures, data structures, and file path mappings.
2. **Verify Baseline Test Suite Stability**:
   - Run:
     ```bash
     npx jest --testPathIgnorePatterns="skills"
     ```
   - Confirm all 14 test suites and 187 tests pass with 0 errors.
3. **Invalidation Conditions**:
   - The specification is invalidated if any proposed interface conflicts with existing `messageHandler.js` routing conventions or requires dependencies that break the Node.js 18+ runtime contract.
