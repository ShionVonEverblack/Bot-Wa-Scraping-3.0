# Specification: R3 & R4 Upgrades for Bot WA Scraping 3.0 (Rima)

**Document Version:** 1.0.0  
**Status:** Approved Specification  
**Target:** Bot WA Scraping 3.0 (Rima)  
**Author:** spec_miner_survey_3  
**Working Directory:** `C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main`

---

## 1. Executive Summary & Scope

This specification defines the architectural blueprint, module interfaces, data models, and verification suites for:
1. **R3: LLM-Ready Web Crawling & Adaptive Scraping** (Primary Feature Priority)
   - Inspired by: `firecrawl/firecrawl`, `unclecode/crawl4ai`, `D4Vinci/Scrapling`, and `Panniantong/Agent-Reach`.
   - Core Pillars: Clean LLM-ready Markdown and structured JSON extraction (stripping boilerplate, ads, cookie banners, navigation noise), adaptive resilient element matching surviving DOM class mutations, stealth/anti-bot evasion, and native Node.js architecture with cascading external API/CLI bridges (`Native Stealth -> Agent-Reach / Jina Reader -> Firecrawl API -> Python CLI`).
2. **R4: Structured PDF/RAG, Knowledge Graph Context & Persistent Memory**
   - Inspired by: `opendataloader-project/opendataloader-pdf`, `infiniflow/ragflow`, `Graphify-Labs/graphify`, `thedotmack/claude-mem`, `headroomlabs-ai/headroom`, and `langgenius/dify`.
   - Core Pillars: Layout-aware PDF and document chunking (hierarchical headers, table preservation, breadcrumb context injection), accurate zero-dependency RAG Q&A, entity/concept relationship knowledge graph extraction and traversal, persistent 3-layer cross-session user memory (working, semantic profile, episodic), automatic headroom context compression, and multi-step agentic research workflows.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R3 - Scraping | Boilerplate & Noise Stripper | Heuristic removal of script, style, nav, footer, ads, cookie consent, modals, tracking pixels | Raw HTML string or Cheerio DOM | Sanitized main content DOM root | Returns root body if heuristics strip everything | `firecrawl`, `crawl4ai` |
| 2 | R3 - Scraping | LLM-Ready Markdown Converter | Converts cleaned DOM into token-dense semantic Markdown preserving headings, tables, clean links, and alt texts | Clean DOM / HTML, Options (`includeTables`, `includeLinks`, `maxTokens`) | Markdown string with frontmatter metadata | Fallback to text content if Markdown serialization fails | `firecrawl`, `crawl4ai` |
| 3 | R3 - Scraping | Schema-Guided Structured JSON Extractor | Extracts structured JSON matching user/system schema from web pages using deterministic rules or LLM prompt | HTML / Markdown, JSON Schema definition | Validated JSON object adhering to schema | Returns partial fields + error flags if validation fails | `crawl4ai`, `firecrawl` |
| 4 | R3 - Resilient | Element Signature Fingerprinting | Captures multi-attribute signature of DOM elements (tag, attributes, text pattern, DOM path, landmark relations) | Cheerio element or Puppeteer ElementHandle | `ElementSignature` object | Throws `INVALID_ELEMENT` if node is null/detached | `Scrapling` |
| 5 | R3 - Resilient | Adaptive Resilient Selector Matcher | Locates target elements when CSS classes or minor DOM hierarchy changes via multi-attribute similarity scoring | HTML / DOM, `ElementSignature`, `similarityThreshold` (default 0.65) | Matched ElementHandle / Cheerio selection + match score | Returns null if highest score < threshold | `Scrapling` |
| 6 | R3 - Resilient | Self-Healing Selector Store | Persists and updates working selectors when DOM mutations are resolved so subsequent runs bypass discovery latency | `templateId` / `urlPattern`, `oldSelector`, `healedSelector`, score | Void / Boolean success | Logs warning and skips write on filesystem lock | `Scrapling` |
| 7 | R3 - Stealth | Advanced Browser Stealth Engine | Masks `navigator.webdriver`, emulates plugins, randomized viewport, language headers, and WebGL/canvas fingerprinting | Puppeteer `Page` instance | Configured stealth `Page` | Throws `STEALTH_ATTACH_FAILED` if CDP session errors | `Scrapling`, `crawl4ai` |
| 8 | R3 - Stealth | Cloudflare / Anti-Bot Challenge Detector | Detects CF 503, Turnstile, PerimeterX, and Datadome challenge pages and triggers wait or bridge fallback | Page content, HTTP status, DOM markers | `{ isBlocked: boolean, challengeType: string }` | Returns `isBlocked: false` if detection fails | `Scrapling`, `Agent-Reach` |
| 9 | R3 - Crawling | Recursive Domain Crawler | Multi-page spidering with depth limit, max page budget, same-domain enforcement, and URL deduplication | Seed URL, `{ maxDepth, maxPages, stayOnDomain, delayMs }` | Array of page crawl results `{ url, markdown, title, links }` | Skips failed subpages, returns partial results | `firecrawl`, `crawl4ai` |
| 10 | R3 - Bridges | Cascading Bridge Orchestrator | Seamlessly falls back across scraping engines: Native Stealth -> Jina Reader (Agent-Reach) -> Firecrawl API -> Python CLI | Target URL, Scraping Options | Unified `ScrapeResult` object | If all tiers fail, throws aggregate `ALL_BRIDGES_FAILED` | `Agent-Reach` |
| 11 | R3 - Bridges | Jina Reader / Agent-Reach Bridge | HTTP bridge fetching clean markdown from `https://r.jina.ai/<url>` without local browser overhead | URL, `{ headers, timeout }` | Clean Markdown string, title, metadata | Returns HTTP error code on 4xx/5xx | `Agent-Reach` |
| 12 | R3 - Bridges | Firecrawl API Bridge | Remote API bridge to Firecrawl `/v1/scrape`, `/v1/crawl`, and `/v1/map` | URL, API Key, Firecrawl options | Markdown, HTML, JSON, links | Throws `FIRECRAWL_KEY_MISSING` or API error message | `firecrawl` |
| 13 | R3 - Bridges | Python CLI Bridge | Subprocess bridge invoking local `scrapling` or `crawl4ai` CLI if Python environment is available | Command line args, target URL | Process stdout JSON | Throws `PYTHON_EXEC_FAILED` or timeout if process hangs | `Scrapling`, `crawl4ai` |
| 14 | R3 - Bot UX | Natural Language URL Reader & Summarizer | Intercepts URLs sent in WhatsApp chat, auto-scrapes clean Markdown, and delivers concise AI summaries | Inbound WhatsApp message with URL | WhatsApp formatted reply message with source link | Sends friendly error message if URL unreachable | Bot core, `messageHandler` |
| 15 | R4 - Document | Layout-Aware PDF Parser | Extracts PDF text while removing headers/footers, reconstructing multi-column reading order, and identifying titles | PDF Buffer or file path | `StructuredDocument` with pages, sections, tables | Falls back to sequential text if layout parse fails | `opendataloader-pdf`, `ragflow` |
| 16 | R4 - Document | Table Structure Reconstructor | Detects grid alignments and tab stops in documents and formats them into clean Markdown / JSON tables | Document layout lines / tokens | Markdown table strings or 2D cell arrays | Returns raw delimited text if grid cannot be inferred | `opendataloader-pdf`, `ragflow` |
| 17 | R4 - Document | Context-Aware Document Chunker | Splits documents along section boundaries and injects hierarchical breadcrumbs (`[Doc > Section > Page]`) | `StructuredDocument`, `{ chunkSize, overlap, preserveSections }` | Array of `DocumentChunk` with metadata | Fallback to character chunking if no headings found | `ragflow` |
| 18 | R4 - RAG | Zero-Dependency Hybrid RAG Retriever | Combines BM25 lexical scoring with Cosine term similarity and Reciprocal Rank Fusion (RRF) for top-k retrieval | Query string, Array of `DocumentChunk`, `topK` (default 4) | Ranked `DocumentChunk[]` with relevance scores | Returns top available chunks or empty array | `ragflow` |
| 19 | R4 - RAG | Grounded RAG Q&A Generator | Injects retrieved chunks into AI prompt with strict groundness instructions and citations (`[Page X, Section Y]`) | Question, Retrieved Chunks, AI Provider | Grounded answer string with citations | Answers "Informasi tidak ditemukan" if chunks lack context | `ragflow` |
| 20 | R4 - Graph | Entity & Relationship Triple Extractor | Identifies entities (Persons, Orgs, Concepts, Tech, Datasets) and relationships `(Subject, Predicate, Object)` | Document text / Markdown, domain hints | Array of `EntityNode` and `RelationEdge` | Returns empty graph if no entities recognized | `graphify` |
| 21 | R4 - Graph | In-Memory & Persistent Knowledge Graph | Stores entities and edges, indexes by alias/lemma, and persists to JSON/SQLite | Entities, Edges, Graph queries | Adjacency list, neighbor lookups, subgraphs | Handles circular references gracefully | `graphify` |
| 22 | R4 - Graph | Knowledge Graph Context Expander | Traverses 1-hop / 2-hop graph neighbors of query entities to enrich context for RAG and search queries | Query text, `KnowledgeGraph`, max expansion tokens | Graph context text block with related entities | Returns empty string if query entities not in graph | `graphify` |
| 23 | R4 - Graph | Mermaid Diagram Visualizer | Generates Mermaid `graph TD` diagrams from knowledge subgraphs for direct visualization in WhatsApp | Subgraph / Entity list | Mermaid markdown code block | Truncates to max 15 nodes to avoid WA clutter | `graphify` |
| 24 | R4 - Memory | Persistent User Memory Store | File-backed atomic JSON storage (`cache/memory/{userId}.json`) preserving user state across bot restarts | `userId`, Memory data payload | Loaded / Updated User Memory record | Re-creates default empty memory if file corrupt | `claude-mem` |
| 25 | R4 - Memory | 3-Layer Memory Architecture | Separates Working Memory (dialogue buffer), Semantic Memory (user profile/facts), and Episodic Memory (past tasks) | Interaction events, user statements | Structured `UserMemoryState` | Drops oldest ephemeral events if limit reached | `claude-mem` |
| 26 | R4 - Memory | Automatic Headroom Context Compressor | Calculates token headroom against model context limit and summarizes older turns into a rolling summary | Conversation history, token budget (e.g. 2000) | Compressed context `{ rollingSummary, recentTurns }` | Retains verbatim turns if within budget | `headroom` |
| 27 | R4 - Memory | Memory Inspection & Reset Commands | Provides `!memory` (view stored profile) and `!memory clear` (reset memory) commands for transparency | WhatsApp command message | Formatted WhatsApp memory summary | Requires user confirmation for destructive clears | `claude-mem` |
| 28 | R4 - Workflow | Declarative Multi-Step Research Engine | Coordinates complex agentic workflows: Plan -> Multi-source Crawl -> Layout Parse -> Graph Map -> Synthesize | Topic / Research Prompt, Options | Comprehensive research report + data package | Pauses on step error, allows retry via `!workflow retry` | `dify` |
| 29 | R4 - Workflow | Workflow State Machine & Persistence | Records step statuses, checkpoints interim artifacts, and enables `!status <workflowId>` tracking | Workflow ID, Step transitions | Persistent workflow state on disk | State restored from disk on bot restart | `dify` |

---

## 3. Edge Cases & Handling Strategies

| # | Feature | Input / Condition | Observed / Desired Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Boilerplate Stripper | Web page where content is completely inside nested non-semantic `<div>` elements without `<article>` or `<main>` | Evaluates text-to-tag ratio and word count across all top-level containers; selects container with highest density; never returns empty string. |
| 2 | Markdown Converter | HTML contains deep nested tables or tables with broken `rowspan`/`colspan` tags | Normalizes irregular cells into a standard 2D grid with placeholder dashes; emits valid GFM table syntax without syntax breakdown. |
| 3 | Markdown Converter | Web page containing massive 10MB+ inline base64 images | Truncates or replaces inline base64 images with `[Image: base64 omitted, size: X KB]` to protect LLM context window from token exhaustion. |
| 4 | Adaptive Selector | Target website undergoes Tailwind / CSS-in-JS class name re-hashing (e.g., `.price-tag` becomes `.css-19xq2a`) | Exact selector fails; fallback kicks in matching `data-testid`, text pattern matching (e.g. `Rp`, `$`), and DOM tree proximity; heals selector. |
| 5 | Adaptive Selector | Web page has multiple identical elements (e.g. 50 product cards on an e-commerce page) | Evaluates sibling repetition index; extracts array of items using repeated card structure instead of halting on single element match. |
| 6 | Stealth Engine | Target site renders Cloudflare 5-second Turnstile challenge or HTTP 403 Forbidden | Detects challenge signature; waits up to 6s for auto-solve; if unresolved, smoothly falls back to Jina Reader or Firecrawl bridge. |
| 7 | Bridge Manager | External API bridge (Firecrawl / Jina) returns 429 Rate Limited or 504 Gateway Timeout | Circuit breaker marks bridge temporarily degraded; immediately routes request to the next available bridge tier without crashing. |
| 8 | Recursive Crawler | Web page contains circular links or endless pagination (e.g. calendar views) | URL canonicalizer normalizes paths, strips tracking query params (`utm_*`, `ref`), and enforces hard `visitedUrls` Set and `maxDepth` limit. |
| 9 | Layout PDF Parser | PDF is a scanned image with no embedded text layer | Detects zero extracted characters; flags document as `SCANNED_PDF`; dispatches to OCR pipeline (`tesseract` / AI vision) instead of silent failure. |
| 10 | Layout PDF Parser | Multi-column academic paper (e.g. 2-column IEEE / ACM format) | Sorts text blocks geometrically by column bounds (X-coordinates) before vertical reading order (Y-coordinates) to prevent cross-column text interleaving. |
| 11 | Document Chunker | A single section (e.g., Code listing or Data Table) exceeds the maximum chunk token size | Sub-splits large block with semantic markers (`[Table Continued, Part 2]`) and preserves table header row across all sub-chunks. |
| 12 | Hybrid RAG | User query contains domain terminology with zero lexical match in document (vocabulary mismatch) | Cosine / semantic fallback retrieves nearest conceptual chunks; if confidence remains below threshold, politely informs user rather than hallucinating. |
| 13 | Knowledge Graph | Extracted entities have duplicate synonyms (e.g. "GPT-4", "GPT 4", "OpenAI GPT-4") | Alias resolution and lemmatization canonicalizes entities to single node with aliases stored in node metadata. |
| 14 | Knowledge Graph | Cyclic relationship loops (e.g., A USES B, B USES C, C USES A) | Traversal algorithm tracks `visitedNodes` Set with max depth limit (default 2 hops) to prevent infinite recursion during query expansion. |
| 15 | Persistent Memory | User sends multiple rapid messages while bot is restarting or disk is busy | Uses atomic write (`.tmp` file + `fs.renameSync`) with in-memory write queue to prevent JSON corruption or partial file truncation. |
| 16 | Context Compressor | User conversation history has zero redundant filler (every turn contains dense technical instructions) | Summarizer extracts structured bullet points preserving all technical constraints; guarantees essential facts are never pruned. |
| 17 | Agentic Workflow | Long-running multi-step research workflow exceeds WhatsApp message timeout (e.g. taking 45 seconds) | Sends immediate WhatsApp ack with Job ID (`⏳ Memulai riset...`), publishes incremental progress via message edits/replies, and uploads final report. |

---

## 4. Module Interfaces & Method Signatures

### 4.1. R3: Web Crawling & Adaptive Scraping Engine

#### Directory Layout:
```
src/
└── engine/
    └── crawler/
        ├── markdownConverter.js     # Clean LLM Markdown & Boilerplate Stripper
        ├── adaptiveSelector.js      # Resilient Element Matcher & Fingerprinter
        ├── stealthEngine.js         # Anti-bot Evasion & Challenge Detection
        ├── crawler.js               # Multi-page Recursive Spider
        ├── resilientStore.js        # Self-healing selector cache
        └── bridges/
            ├── bridgeManager.js     # Cascading Multi-tier Router
            ├── agentReach.bridge.js # Jina Reader API wrapper
            ├── firecrawl.bridge.js  # Firecrawl API client
            └── pythonCli.bridge.js  # Scrapling / Crawl4AI subprocess bridge
```

#### `src/engine/crawler/markdownConverter.js`
```javascript
/**
 * @typedef {Object} MarkdownConvertOptions
 * @property {boolean} [stripNav=true] - Remove nav, header, footer, sidebar
 * @property {boolean} [stripAds=true] - Remove ad containers and sponsored links
 * @property {boolean} [includeImages=true] - Retain descriptive images with alt text
 * @property {boolean} [includeTables=true] - Format tables as Markdown
 * @property {boolean} [includeLinks=true] - Retain hyperlinks (cleaned of tracking params)
 * @property {number} [maxTokens=8000] - Hard cap on generated markdown length
 */

/**
 * @typedef {Object} MarkdownResult
 * @property {string} markdown - Clean, token-dense Markdown representation
 * @property {string} title - Extracted title
 * @property {string} description - Meta description or executive lead
 * @property {Object} metadata - OpenGraph, Twitter, and canonical metadata
 * @property {Array<{text: string, href: string}>} links - Extracted clean links
 * @property {Array<{alt: string, src: string}>} images - Extracted images
 * @property {number} tokenEstimate - Approximate token count
 */

/**
 * Clean HTML and convert to LLM-ready Markdown.
 * @param {string} html - Raw HTML source
 * @param {MarkdownConvertOptions} [options]
 * @returns {MarkdownResult}
 */
function htmlToMarkdown(html, options = {}) { ... }

/**
 * Extract structured JSON using heuristic CSS selectors or LLM schema.
 * @param {string} markdownOrHtml - Page content
 * @param {Object} schema - JSON schema specification
 * @param {Object} [aiOptions] - Optional AI service config for schema mapping
 * @returns {Promise<Object>} Structured JSON data
 */
async function extractStructuredJson(markdownOrHtml, schema, aiOptions = {}) { ... }
```

#### `src/engine/crawler/adaptiveSelector.js`
```javascript
/**
 * @typedef {Object} ElementSignature
 * @property {string} tag - Tag name (e.g. 'div', 'button', 'span')
 * @property {string|null} id - Element ID if present
 * @property {string[]} classes - Class names
 * @property {Object<string, string>} attributes - Key-value map of all attributes (data-*, aria-*, role)
 * @property {string} textPattern - Normalized text or regex representation
 * @property {string} domPath - Structural path (e.g. 'body > main > section:nth-of-type(2)')
 * @property {string|null} landmark - Nearest preceding heading or label text
 */

/**
 * Generate a resilient multi-attribute signature from a DOM element.
 * @param {import('cheerio').Cheerio<any>|any} element - Target element
 * @returns {ElementSignature}
 */
function generateSignature(element) { ... }

/**
 * Resiliently find elements matching signature even after class/DOM mutations.
 * @param {import('cheerio').CheerioAPI|any} $ - Cheerio root or Puppeteer page
 * @param {ElementSignature} signature - Target element signature
 * @param {number} [threshold=0.65] - Similarity score threshold
 * @returns {Array<{element: any, score: number}>} Matched elements with confidence scores
 */
function findResilient($, signature, threshold = 0.65) { ... }

/**
 * Auto-heal a broken selector by querying page with signature and persisting new selector.
 * @param {string} url - Target page URL
 * @param {string} originalSelector - Selector that failed
 * @param {ElementSignature} signature - Baseline signature
 * @returns {Promise<string|null>} New healed CSS selector or null if not found
 */
async function healSelector(url, originalSelector, signature) { ... }
```

#### `src/engine/crawler/stealthEngine.js`
```javascript
/**
 * Apply stealth evasion to a Puppeteer page instance.
 * @param {import('puppeteer-core').Page} page
 * @returns {Promise<void>}
 */
async function applyStealth(page) { ... }

/**
 * Inspect page content for Cloudflare, PerimeterX, or Turnstile challenge screens.
 * @param {import('puppeteer-core').Page} page
 * @returns {Promise<{isBlocked: boolean, challengeType: string|null}>}
 */
async function detectAntiBotChallenge(page) { ... }
```

#### `src/engine/crawler/crawler.js`
```javascript
/**
 * @typedef {Object} CrawlOptions
 * @property {number} [maxDepth=2] - Maximum link hops from seed
 * @property {number} [maxPages=10] - Maximum pages to retrieve
 * @property {boolean} [stayOnDomain=true] - Only follow links on same origin
 * @property {number} [delayMs=1000] - Politeness delay between requests
 * @property {string[]} [excludePatterns] - Glob/Regex patterns to ignore
 */

/**
 * Recursively crawl starting from a seed URL.
 * @param {string} seedUrl - Starting URL
 * @param {CrawlOptions} [options]
 * @returns {Promise<Array<{url: string, title: string, markdown: string, depth: number}>>}
 */
async function crawl(seedUrl, options = {}) { ... }
```

#### `src/engine/crawler/bridges/bridgeManager.js`
```javascript
/**
 * Execute scraping using cascading resilience:
 * Tier 1: Native Stealth Puppeteer / Cheerio
 * Tier 2: Agent-Reach (Jina Reader API)
 * Tier 3: Firecrawl API (if FIRECRAWL_API_KEY configured)
 * Tier 4: Local Python CLI (if Python + scrapling/crawl4ai available)
 *
 * @param {string} url - Target URL
 * @param {Object} [options] - Extraction options
 * @returns {Promise<{source: string, markdown: string, metadata: Object}>}
 */
async function scrapeWithFallback(url, options = {}) { ... }
```

---

### 4.2. R4: Structured PDF/RAG, Knowledge Graph & Persistent Memory

#### Directory Layout:
```
src/
├── services/
│   ├── document/
│   │   ├── layoutPdfParser.js     # Layout-aware PDF & Table extractor
│   │   ├── documentChunker.js     # Semantic Chunking with breadcrumbs
│   │   └── documentRagEngine.js   # Zero-dependency Hybrid BM25+Vector RAG
│   ├── graph/
│   │   ├── entityExtractor.js     # Entity & Relation Triple Extractor
│   │   └── knowledgeGraph.js      # Graph store, traversal & Mermaid generator
│   ├── memory/
│   │   ├── persistentMemoryStore.js # File-backed atomic JSON memory store
│   │   ├── layeredMemoryManager.js  # Working, Semantic Profile, Episodic layers
│   │   └── contextCompressor.js     # Headroom-style token context compression
│   └── workflow/
│       └── researchWorkflowEngine.js # Multi-step agentic research DAG execution
```

#### `src/services/document/layoutPdfParser.js`
```javascript
/**
 * @typedef {Object} StructuredSection
 * @property {string} heading - Section title (e.g. "1. Introduction")
 * @property {number} level - Heading level (1, 2, 3)
 * @property {number} pageNumber - Page where section begins
 * @property {string} content - Section body text
 * @property {Array<string>} tables - Markdown formatted tables within section
 */

/**
 * @typedef {Object} StructuredDocument
 * @property {string} title - Document title
 * @property {string[]} authors - Extracted author names
 * @property {string} abstract - Abstract content
 * @property {StructuredSection[]} sections - Hierarchical sections
 * @property {number} totalPages - Total page count
 * @property {string} fullText - Full normalized text
 */

/**
 * Parse a PDF buffer with layout awareness, table preservation, and multi-column ordering.
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {Object} [options] - Parsing configuration
 * @returns {Promise<StructuredDocument>}
 */
async function parsePdf(pdfBuffer, options = {}) { ... }
```

#### `src/services/document/documentChunker.js`
```javascript
/**
 * @typedef {Object} DocumentChunk
 * @property {string} id - Unique chunk hash
 * @property {string} text - Chunk content with breadcrumb context
 * @property {string} rawContent - Content without breadcrumbs
 * @property {string} breadcrumb - Hierarchical context path (e.g. "DocTitle > Methods > Page 3")
 * @property {number} pageNumber - Source page
 * @property {string} sectionHeading - Enclosing section
 * @property {number} tokenCount - Estimated tokens
 */

/**
 * Chunk a structured document into context-aware passages.
 * @param {StructuredDocument} document - Output from layoutPdfParser
 * @param {Object} [options]
 * @param {number} [options.targetTokens=400] - Target tokens per chunk
 * @param {number} [options.overlapTokens=50] - Overlap between adjacent chunks
 * @returns {DocumentChunk[]}
 */
function chunkDocument(document, options = {}) { ... }
```

#### `src/services/document/documentRagEngine.js`
```javascript
/**
 * Index a document for zero-dependency local retrieval.
 * @param {string} docId - Unique document ID
 * @param {DocumentChunk[]} chunks - Chunks to index
 */
function indexDocument(docId, chunks) { ... }

/**
 * Retrieve top-k chunks using Hybrid BM25 and Token-Cosine scoring.
 * @param {string} docId - Target document index
 * @param {string} query - User question
 * @param {number} [topK=4] - Number of chunks to return
 * @returns {Array<DocumentChunk & {score: number}>}
 */
function retrieveChunks(docId, query, topK = 4) { ... }

/**
 * Answer a question grounded strictly in document context with citations.
 * @param {string} docId - Target document ID
 * @param {string} question - User question
 * @param {Object} [aiOptions] - AI service options
 * @returns {Promise<{answer: string, citations: Array<{section: string, page: number}>}>}
 */
async function answerQuestion(docId, question, aiOptions = {}) { ... }
```

#### `src/services/graph/knowledgeGraph.js`
```javascript
/**
 * @typedef {Object} EntityNode
 * @property {string} id - Canonical entity identifier
 * @property {string} name - Display name
 * @property {string} type - 'PERSON'|'ORGANIZATION'|'CONCEPT'|'TECHNOLOGY'|'DATASET'|'METRIC'
 * @property {string[]} aliases - Alternate spellings/synonyms
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} RelationEdge
 * @property {string} source - Source entity ID
 * @property {string} target - Target entity ID
 * @property {string} predicate - 'USES'|'CREATED_BY'|'PART_OF'|'OUTPERFORMS'|'EVALUATED_ON'
 * @property {number} weight - Confidence weight
 * @property {string} [sourceDoc] - Provenance citation
 */

class KnowledgeGraph {
  addEntity(entity) { ... }
  addRelation(sourceId, predicate, targetId, metadata = {}) { ... }
  getNeighbors(entityId, depth = 1) { ... }
  findPath(entityA, entityB) { ... }
  
  /**
   * Expand query context by finding entities and 1-hop relations.
   * @param {string} queryText
   * @returns {string} Enriched context block for AI prompt
   */
  expandContext(queryText) { ... }

  /**
   * Export subgraph as Mermaid syntax for WhatsApp visual preview.
   * @param {string[]} rootEntityIds
   * @returns {string} Mermaid diagram markdown
   */
  toMermaid(rootEntityIds) { ... }
}
```

#### `src/services/memory/layeredMemoryManager.js`
```javascript
/**
 * @typedef {Object} UserProfile
 * @property {string} [language='id'] - User preferred language
 * @property {string[]} interests - Topics of interest
 * @property {string[]} activeProjects - Current user tasks
 * @property {Object<string, any>} preferences - Custom formatting preferences
 * @property {string[]} facts - Permanent facts explicitly learned about user
 */

/**
 * @typedef {Object} TaskSummary
 * @property {string} id - Task/Job ID
 * @property {string} type - 'SCRAPE'|'PAPER'|'RESEARCH'
 * @property {string} summary - 1-2 sentence summary of results
 * @property {number} timestamp - Completed timestamp
 */

/**
 * @typedef {Object} LayeredUserMemory
 * @property {string} userId - WhatsApp serialized ID
 * @property {Array<{role: string, content: string, ts: number}>} workingMemory - Recent turns
 * @property {UserProfile} profile - Permanent semantic profile
 * @property {TaskSummary[]} episodicMemory - History of completed tasks
 * @property {string} rollingSummary - Compressed summary of earlier conversations
 * @property {number} updatedAt - Last activity timestamp
 */

/**
 * Retrieve persistent layered memory for a user.
 * @param {string} userId - User phone ID
 * @returns {LayeredUserMemory}
 */
function getMemory(userId) { ... }

/**
 * Record a new dialogue turn or fact.
 * @param {string} userId
 * @param {Object} entry - Turn or fact update
 */
function updateMemory(userId, entry) { ... }

/**
 * Clear user memory (supports partial or complete wipe).
 * @param {string} userId
 * @param {'all'|'working'|'profile'} [scope='all']
 */
function clearMemory(userId, scope = 'all') { ... }
```

#### `src/services/memory/contextCompressor.js`
```javascript
/**
 * Headroom-style context window compression.
 * Analyzes token count against model budget.
 * Summarizes older messages into rollingSummary while keeping latest turns intact.
 *
 * @param {LayeredUserMemory} userMemory
 * @param {number} [tokenBudget=2500] - Target context budget
 * @returns {Promise<{compressedMessages: Array<{role: string, content: string}>, tokensSaved: number}>}
 */
async function compressContext(userMemory, tokenBudget = 2500) { ... }
```

#### `src/services/workflow/researchWorkflowEngine.js`
```javascript
/**
 * @typedef {Object} WorkflowStep
 * @property {string} id - Step identifier
 * @property {string} title - Step description (e.g. "1. Crawl arXiv papers")
 * @property {'PENDING'|'RUNNING'|'COMPLETED'|'FAILED'} status
 * @property {any} [result] - Output of the step
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} ResearchWorkflow
 * @property {string} workflowId - Unique workflow ID
 * @property {string} userId - Initiating user
 * @property {string} topic - Research topic
 * @property {WorkflowStep[]} steps - Ordered DAG steps
 * @property {'PLANNING'|'IN_PROGRESS'|'COMPLETED'|'FAILED'} state
 * @property {Object} artifacts - Generated outputs (markdown, tables, zip)
 */

/**
 * Launch an agentic research workflow.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.topic
 * @param {Object} params.client - WhatsApp client for progress updates
 * @param {string} params.chatId - WhatsApp destination chat ID
 * @returns {Promise<ResearchWorkflow>}
 */
async function startResearch(params) { ... }

/**
 * Check status of an active workflow.
 * @param {string} workflowId
 * @returns {ResearchWorkflow|null}
 */
function getWorkflowStatus(workflowId) { ... }
```

---

## 5. WhatsApp Bot Commands & NLP Integration

### 5.1. Command Catalog Extensions
1. **`!deepscrape <url> [options]`** (Upgraded):
   - Options: `--format markdown|json|text`, `--extract all|markdown|text|tables|links`, `--schema <json>`
   - Output: Formatted WhatsApp preview card + attachment of clean `.md` or `.json` file if content > 2000 chars.
2. **`!crawl <url> [options]`** (New Command):
   - Options: `--depth 1-3` (default 2), `--limit 1-20` (default 5), `--format markdown|json`
   - Spawns multi-page recursive crawl, packs output into ZIP or combined Markdown report.
3. **`!customscrape <url> --selector <css> [options]`** (Upgraded):
   - Integrates `AdaptiveSelectorEngine`. Auto-heals when standard CSS breaks.
4. **`!rag <question>` / `!doc <question>`** (New Command):
   - Answers questions grounded in the active document (PDF / Paper / Web Markdown) in user context.
   - Includes page numbers, section titles, and verbatim quotes.
5. **`!graph [entity]`** (New Command):
   - Shows knowledge graph relations and exports Mermaid diagram for WhatsApp visualization.
6. **`!memory [show|clear]`** (New Command):
   - Displays what the bot has stored in persistent memory about the user or clears it on request.
7. **`!research <topic>`** (New Command):
   - Launches Dify-style multi-step agentic research pipeline.

### 5.2. NLP Intent Extensions (`src/bot/nlp/intentClassifier.js`)
Add new intents:
- `WEB_EXTRACT`: Triggered by patterns like:
  - `/(bacakan|baca|rangkum|ekstrak)\s+(isi\s+)?(web|link|tautan|url|halaman)\s+https?:\/\//i`
  - `/https?:\/\/[^\s]+\s+(tolong\s+)?(rangkum|jelaskan|analisa)/i`
- `DOC_RAG`: Triggered by questions referencing the current document:
  - `/apa\s+(kata|menurut|kesimpulan|metode)\s+(di|dalam)\s+(dokumen|paper|file|pdf)\s*(ini)?/i`
  - `/jelaskan\s+bagian\s+.*\s+(di|dalam)\s+paper/i`
- `RESEARCH_WORKFLOW`: Triggered by deep research prompts:
  - `/(lakukan\s+)?riset\s+(mendalam\s+tentang|mengenai)\s+/i`
  - `/buat(kan)?\s+laporan\s+(lengkap|penelitian)\s+tentang/i`
- `MEMORY_QUERY`: Triggered by memory questions:
  - `/apa\s+(saja\s+yang\s+kamu\s+tahu|yang\s+kamu\s+ingat)\s+tentang\s+(saya|profil)/i`
  - `/lupakan\s+(semua\s+tentang\s+saya|riwayat\s+chat)/i`

---

## 6. Implementation File Plan in `src/`

| Target Path | Action | Role / Responsibility |
|-------------|--------|-----------------------|
| `src/engine/crawler/markdownConverter.js` | Create | Boilerplate noise stripping, Readability/Crawl4AI heuristics, Markdown & schema JSON conversion |
| `src/engine/crawler/adaptiveSelector.js` | Create | Multi-attribute signature fingerprinting, similarity scoring, and self-healing selector logic |
| `src/engine/crawler/stealthEngine.js` | Create | Anti-bot evasion, webdriver masking, user-agent/viewport randomization, challenge detection |
| `src/engine/crawler/crawler.js` | Create | Recursive multi-page web crawler with depth limits and URL deduplication |
| `src/engine/crawler/resilientStore.js` | Create | Persistent cache for healed CSS selectors |
| `src/engine/crawler/bridges/bridgeManager.js` | Create | Cascading router: Native Stealth -> Jina Reader -> Firecrawl API -> Python CLI |
| `src/engine/crawler/bridges/agentReach.bridge.js` | Create | Jina Reader (`r.jina.ai`) zero-setup HTTP bridge |
| `src/engine/crawler/bridges/firecrawl.bridge.js` | Create | Firecrawl API client |
| `src/engine/crawler/bridges/pythonCli.bridge.js` | Create | Subprocess bridge to Python `scrapling` or `crawl4ai` CLI |
| `src/services/document/layoutPdfParser.js` | Create | Layout-aware PDF parser (multi-column, headers/footers removal, table formatting) |
| `src/services/document/documentChunker.js` | Create | Section-aware document chunker with breadcrumb context injection |
| `src/services/document/documentRagEngine.js` | Create | Zero-dependency hybrid lexical (BM25) + vector RAG search & grounded answering |
| `src/services/graph/entityExtractor.js` | Create | Entity and relation triple extractor (rules + LLM schema) |
| `src/services/graph/knowledgeGraph.js` | Create | Graph store, neighbor search, context expander, Mermaid generator |
| `src/services/memory/persistentMemoryStore.js` | Create | Atomic file-backed JSON store for user memory |
| `src/services/memory/layeredMemoryManager.js` | Create | 3-Layer memory orchestrator (working, semantic profile, episodic) |
| `src/services/memory/contextCompressor.js` | Create | Headroom-style token budget manager and rolling summarizer |
| `src/services/workflow/researchWorkflowEngine.js` | Create | Multi-step agentic research DAG execution and persistence |
| `src/commands/handlers/crawl.handler.js` | Create | Command handler for `!crawl` |
| `src/commands/handlers/rag.handler.js` | Create | Command handler for `!rag` / `!doc` |
| `src/commands/handlers/graph.handler.js` | Create | Command handler for `!graph` |
| `src/commands/handlers/memory.handler.js` | Create | Command handler for `!memory` |
| `src/commands/handlers/research.handler.js` | Create | Command handler for `!research` |
| `src/commands/handlers/deepscrape.handler.js` | Modify | Upgrade with `--format markdown` and clean LLM-ready output |
| `src/commands/handlers/customscrape.handler.js` | Modify | Upgrade with `AdaptiveSelectorEngine` |
| `src/bot/nlp/intentClassifier.js` | Modify | Add `WEB_EXTRACT`, `DOC_RAG`, `RESEARCH_WORKFLOW`, `MEMORY_QUERY` rules |
| `src/bot/messageHandler.js` | Modify | Wire URL message detection, PDF document attachments, and persistent memory context |
| `src/config.js` | Modify | Add configuration keys for Firecrawl, Jina, crawling limits, and memory budgets |

---

## 7. Testability & Verification Strategy

### 7.1. Unit & Integration Test Suites
All new functionality will have dedicated automated tests in `tests/`:
1. **`tests/crawler/markdownConverter.test.js`**:
   - Verify boilerplate stripping on HTML samples containing navigation, scripts, ads, and footers.
   - Verify Markdown table formatting and link cleaning (removal of `utm_*` tags).
   - Verify token budget enforcement.
2. **`tests/crawler/adaptiveSelector.test.js`**:
   - Test element signature generation on various DOM elements.
   - Test resilient matching when class names change from `.btn-primary` to `.css-xyz123`.
   - Test healing logic and persistence in `resilientStore`.
3. **`tests/crawler/bridgeManager.test.js`**:
   - Mock native failure and verify automatic fallback to Jina Reader bridge.
   - Mock Jina 429 and verify fallback to Firecrawl API or Python CLI.
4. **`tests/document/layoutPdfParser.test.js`**:
   - Test extraction on synthetic multi-column PDF buffers.
   - Test header and footer removal.
   - Test table reconstruction into Markdown tables.
5. **`tests/document/documentRagEngine.test.js`**:
   - Test context-aware chunking and breadcrumb injection.
   - Test BM25/Cosine hybrid retrieval accuracy on question-answer pairs.
   - Test citation formatting (`[Page X, Section Y]`).
6. **`tests/graph/knowledgeGraph.test.js`**:
   - Test entity node deduplication and alias matching.
   - Test 1-hop and 2-hop neighborhood traversals.
   - Test Mermaid diagram generation.
7. **`tests/memory/persistentMemory.test.js`**:
   - Test save and load across simulated bot reboots.
   - Test atomic write safety and corruption recovery.
   - Test 3-layer memory separation (working, semantic profile, episodic).
8. **`tests/memory/contextCompressor.test.js`**:
   - Test compression trigger when token budget is exceeded.
   - Test retention of recent turns and factual semantic integrity in rolling summary.
9. **`tests/workflow/researchWorkflowEngine.test.js`**:
   - Test multi-step DAG execution sequence.
   - Test state persistence and recovery after simulated restart.

### 7.2. Test Execution Command
Run test suite isolated from skill external directories:
```bash
npx jest --testPathIgnorePatterns="skills"
```
Requirement: 0 failures, 100% pass across all test suites.
