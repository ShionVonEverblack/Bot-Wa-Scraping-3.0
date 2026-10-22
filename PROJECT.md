# Project: Bot WA Scraping 3.0 (Rima) Upgrade

## Architecture
- **Environment**: Node.js 18+ on Windows / Cross-platform.
- **Bot Core**: WhatsApp Web client (`whatsapp-web.js`), NLP intent classifier (`node-nlp`), job scheduler & queue (`src/jobs/`).
- **Skills Subsystem**: `.agents/skills/` (Tier-1 high frequency core skills), `skills/` (complete archives for Karpathy, Superpowers, Matt Pocock, ECC, Anthropics), configured via `.agents/skills.json`.
- **Crawler Subsystem (`src/engine/crawler/`)**:
  - `contentExtractor.js`: HTML boilerplate and noise stripping, content scoring.
  - `markdownConverter.js`: Clean LLM-ready GFM Markdown generator.
  - `adaptiveSelector.js`: Similarity-based resilient selector matching.
  - `stealthEngine.js`: Puppeteer anti-bot evasion and Cloudflare challenge detection.
  - `crawlerBridges.js`: Cascading bridge (Native -> Jina Reader -> Firecrawl -> Python CLI).
  - `resilientStore.js`: Self-healing selector persistence.
- **Document & RAG Subsystem (`src/services/document/`)**:
  - `layoutPdfParser.js`: Multi-column layout-aware PDF text and table extraction.
  - `documentChunker.js`: Contextual chunking with hierarchical breadcrumbs.
  - `documentRagEngine.js`: Zero-dependency hybrid BM25 + Cosine retrieval with RRF.
- **Knowledge Graph Subsystem (`src/services/graph/`)**:
  - `knowledgeGraph.js`: Entity-relation extraction, 1-hop / 2-hop traversal, Mermaid rendering.
- **Memory Subsystem (`src/services/memory/`)**:
  - `layeredMemoryManager.js`: Working memory, Semantic Profile, Episodic memory.
  - `persistentMemoryStore.js`: File-backed JSON persistence and token-budgeted compression.
- **Workflow Subsystem (`src/services/workflow/`)**:
  - `researchWorkflowEngine.js`: Multi-step agentic research DAG with disk checkpoints.
- **Bot Integration (`src/bot/`)**:
  - `messageHandler.js`: Routing for NLP intents, document context, memory awareness.
  - `src/commands/handlers/`: Commands (`deepscrape`, `crawl`, `docqa`, `memory`, `graph`, `research`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F01_Karpathy_Skills | Extract `andrej-karpathy-skills-main.zip` and install `karpathy-guidelines` | M1 | Survey 1 |
| 2 | F02_External_Skills_Fetch | Clone/copy skills from `obra/superpowers`, `mattpocock/skills`, `affaan-m/ECC`, `anthropics/skills` | M1 | Survey 1 |
| 3 | F03_Core_Skills_Staging | Stage Tier-1 active skills in `.agents/skills/` with valid `SKILL.md` frontmatter | M1 | Survey 1 |
| 4 | F04_Skills_Json_Config | Configure `.agents/skills.json` multi-entry discovery paths | M1 | Survey 1 |
| 5 | F05_Skills_Frontmatter_Validation | Run automated validator verifying 100% compliant `SKILL.md` YAML frontmatter | M1 | Survey 1 |
| 6 | F06_Gitignore_Hardening | Whitelist source directories (`!src/`, `!src/**`, `!tests/**`) and add runtime folders | M1 | Survey 2 |
| 7 | F07_Module_Integrity_Check | Verify zero `MODULE_NOT_FOUND` across all files in `src/` and dependencies | M1 | Survey 2 |
| 8 | F08_Jobs_Unit_Tests | Implement comprehensive Jest unit test suites for `src/jobs/` | M1 | Survey 2 |
| 9 | F09_Boilerplate_Noise_Stripping | Strip ads, nav, footer, modals, cookie banners with text-density heuristics | M2 | Survey 3 |
| 10 | F10_LLM_Markdown_Converter | Token-dense GFM Markdown generation with tables, links, code blocks | M2 | Survey 3 |
| 11 | F11_Structured_JSON_Extractor | Extract structured JSON with schemas, headings, metadata, and JSON-LD | M2 | Survey 3 |
| 12 | F12_Adaptive_Selector_Matching | Multi-attribute signature similarity algorithm for resilient element extraction | M2 | Survey 3 |
| 13 | F13_Resilient_Selector_Store | File-backed selector cache that heals broken selectors automatically | M2 | Survey 3 |
| 14 | F14_Stealth_Evasion_Engine | Puppeteer fingerprint masking and Cloudflare challenge detection | M2 | Survey 3 |
| 15 | F15_Cascading_Crawler_Bridges | External crawler bridge fallback (Jina Reader, Firecrawl, CLI) | M2 | Survey 3 |
| 16 | F16_Scraping_Commands_NLP | Bot command and NLP handler integration (`!deepscrape`, `!crawl`) | M2 | Survey 3 |
| 17 | F17_Layout_Aware_PDF_Parser | Layout-aware multi-column PDF text extraction with header/footer removal | M3 | Survey 3 |
| 18 | F18_PDF_Table_Extractor | Detect PDF grid tables and format as clean Markdown tables | M3 | Survey 3 |
| 19 | F19_Contextual_Document_Chunker | Chunking with injected breadcrumbs (`[Doc > Section > Page]`) | M3 | Survey 3 |
| 20 | F20_Hybrid_Local_RAG | Zero-dependency BM25 + Cosine retrieval with Reciprocal Rank Fusion | M3 | Survey 3 |
| 21 | F21_Document_QA_Pipeline | Document Q&A integration in `messageHandler.js` using `lastDocumentText` | M3 | Survey 3 |
| 22 | F22_Knowledge_Graph_Extraction | Extract entity-relationship triples from text and documents | M3 | Survey 3 |
| 23 | F23_Graph_Context_Traversal | Multi-hop (1-hop / 2-hop) subgraph retrieval for query context | M3 | Survey 3 |
| 24 | F24_Mermaid_Graph_Renderer | Generate Mermaid diagram syntax for WhatsApp rendering | M3 | Survey 3 |
| 25 | F25_Layered_Persistent_Memory | 3-tier memory store (Working, Semantic, Episodic) with JSON persistence | M3 | Survey 3 |
| 26 | F26_Context_Window_Compression | Token-budgeted rolling summarization and context window compression | M3 | Survey 3 |
| 27 | F27_Cross_Session_Persistence | Persist user facts and history across bot restarts | M3 | Survey 3 |
| 28 | F28_Research_Workflow_Engine | Multi-step agentic research DAG with disk checkpoints and status callbacks | M3 | Survey 3 |
| 29 | F29_Doc_Graph_Memory_Commands | Bot commands (`!docqa`, `!memory`, `!graph`, `!research`) and NLP intent mapping | M3 | Survey 3 |
| 30 | F30_E2E_Test_Suite_Pass | 100% passing automated E2E tests across Tiers 1-4 with zero failures | M4 | Dual Track |
| 31 | F31_Adversarial_Coverage_Hardening | Tier-5 white-box adversarial testing and edge case verification | M4 | Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Restoration & Skills Integration | F01 - F08 | none | IN_PROGRESS (worker_m1: eba60e42-a00c-4569-958d-50601c6328c6) |
| M2 | LLM-Ready Web Crawling & Adaptive Scraping | F09 - F16 | M1 | PLANNED |
| M3 | Structured PDF/RAG, Knowledge Graph & Persistent Memory | F17 - F29 | M1 | PLANNED |
| M4 | Final Integration, E2E Test Pass & Coverage Hardening | F30 - F31 | M2, M3, TEST_READY.md | PLANNED |

## Interface Contracts

### Crawler Engine (`src/engine/crawler/`)
- `markdownConverter.cleanHtml(html: string, options?: CleanOptions): { cleanedHtml: string, title: string, textDensity: number }`
- `markdownConverter.htmlToMarkdown(html: string, options?: MarkdownOptions): { markdown: string, metadata: object }`
- `contentExtractor.extract(html: string, options?: ExtractOptions): Promise<{ markdown: string, json: object, metadata: object }>`
- `adaptiveSelector.findAdaptive(pageOrCheerio: any, signature: ElementSignature): Promise<CandidateResult>`
- `resilientStore.getHealedSelector(domain: string, originalSelector: string): string | null`
- `resilientStore.saveHealedSelector(domain: string, originalSelector: string, healedSelector: string): void`
- `stealthEngine.applyEvasion(page: PuppeteerPage): Promise<void>`
- `crawlerBridges.fetchViaBridge(url: string, options?: BridgeOptions): Promise<{ markdown: string, content: string, provider: string }>`

### Document & RAG Services (`src/services/document/`)
- `layoutPdfParser.parsePdf(bufferOrPath: Buffer | string, options?: PdfOptions): Promise<{ text: string, pages: Array<{ pageNum: number, text: string, tables: Array<string> }>, metadata: object }>`
- `documentChunker.chunkDocument(doc: ParsedDocument, options?: ChunkOptions): Array<{ id: string, text: string, breadcrumb: string, pageNum: number }>`
- `documentRagEngine.indexDocument(docId: string, chunks: Array<Chunk>): Promise<void>`
- `documentRagEngine.query(docId: string, queryText: string, topK?: number): Promise<Array<{ text: string, score: number, breadcrumb: string }>>`

### Knowledge Graph Service (`src/services/graph/`)
- `knowledgeGraph.extractTriples(text: string): Promise<Array<{ subject: string, predicate: string, object: string }>>`
- `knowledgeGraph.addTriples(triples: Array<Triple>): void`
- `knowledgeGraph.getNeighbors(entity: string, hops?: number): SubGraph`
- `knowledgeGraph.toMermaid(subgraph?: SubGraph): string`

### Memory Service (`src/services/memory/`)
- `layeredMemoryManager.addMessage(userId: string, role: string, content: string): Promise<void>`
- `layeredMemoryManager.getContext(userId: string, maxTokens?: number): Promise<{ history: Array<Message>, profile: object, compressedSummary: string }>`
- `persistentMemoryStore.save(): Promise<void>`
- `persistentMemoryStore.load(): Promise<void>`

### Workflow Service (`src/services/workflow/`)
- `researchWorkflowEngine.executePlan(plan: ResearchPlan, onProgress?: (step: object) => void): Promise<ResearchResult>`

## Code Layout
- `src/engine/crawler/`: Web crawling, Markdown conversion, adaptive selectors, stealth evasion, bridges.
- `src/services/document/`: Layout PDF parsing, chunking, local RAG retrieval.
- `src/services/graph/`: Knowledge graph extraction, traversal, Mermaid rendering.
- `src/services/memory/`: Layered memory store, persistent memory, compression.
- `src/services/workflow/`: Research workflow engine and DAG runner.
- `src/jobs/`: Job schemas, queue, worker, paperWorker, jobManager.
- `src/commands/handlers/`: Command handlers including new crawling, docqa, memory, graph, research commands.
- `tests/`: Automated unit & integration tests organized by module (`tests/jobs/`, `tests/crawler/`, `tests/document/`, `tests/graph/`, `tests/memory/`, `tests/workflow/`, `tests/e2e/`).
- `.agents/skills/`: Active Tier-1 discoverable skills with valid `SKILL.md`.
- `skills/`: Comprehensive skills repository archives.
