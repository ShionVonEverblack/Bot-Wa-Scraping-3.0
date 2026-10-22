# TEST_INFRA.md — Bot WA Scraping 3.0 (Rima) Test Infrastructure

## 1. Overview & Test Architecture

Bot WA Scraping 3.0 uses a 4-tier requirement-driven, opaque-box test architecture implemented in **Jest**. All tests execute against genuine system implementations without facade mocks, verifying end-to-end behavior, mathematical properties, structural contracts, and real-world failure modes.

### 4-Tier Test Matrix

| Tier | Purpose | Suites | Tests | Coverage Scope |
|------|---------|--------|-------|----------------|
| **Tier 1: Feature Coverage** | Isolated functionality verification | 5 | 155 | All 31 features (F01–F31), $\ge$ 5 tests/feature |
| **Tier 2: Boundary & Corner Cases** | Limits, empty buffers, extreme sizes, malformed input | 4 | 155 | All 31 features at stress boundaries |
| **Tier 3: Cross-Feature Combinations** | Pairwise and cross-subsystem pipeline interactions | 4 | 24 | Crawl-to-Graph, Doc-to-RAG, Adaptive Healing, Headroom Memory |
| **Tier 4: Real-World Scenarios** | Realistic end-to-end user workflows | 4 | 9 | Academic Researcher, Competitive Scraper, Knowledge Explorer, WhatsApp Flow |
| **TOTAL** | **Full E2E Suite** | **17** | **343** | **100% Feature Inventory Coverage** |

---

## 2. Directory Layout

```
tests/
├── fixtures/
│   ├── samplePages.js                 # HTML fixtures (blog, ecommerce, mutated, table, malformed, schema)
│   ├── sampleDocs.js                  # Document fixtures (academic paper, graph corpus, multi-turn chat, JSON items)
│   └── mockHelpers.js                 # Isolated WhatsApp message & client envelopes with jest.fn() spies
└── e2e/
    ├── tier1_feature_coverage/
    │   ├── m1_skills_core.test.js     # F01 - F08: Skills, plugins, NLP, job store, config (40 tests)
    │   ├── m2_crawler_scraping.test.js# F09 - F16: LLM-ready crawler, markdown, adaptive selector, stealth (40 tests)
    │   ├── m3_doc_rag.test.js         # F17 - F21: Layout PDF parser, table extractor, chunker, hybrid RAG (25 tests)
    │   ├── m3_graph_memory.test.js    # F22 - F27: Knowledge graph, Mermaid, Claude-Mem, Headroom crusher (30 tests)
    │   └── m3_workflow_m4.test.js     # F28 - F31: Workflow engine, command routing, E2E suite integrity (20 tests)
    ├── tier2_boundary_corner/
    │   ├── boundary_skills_jobs.test.js # F01 - F08: Skills boundaries, invalid configs, job limits (40 tests)
    │   ├── boundary_crawler.test.js     # F09 - F16: Zero-density HTML, circular links, stealth edge cases (40 tests)
    │   ├── boundary_doc_rag.test.js     # F17 - F21: Empty PDFs, giant unpunctuated text, RAG edge cases (25 tests)
    │   └── boundary_graph_memory.test.js# F22 - F31: Disconnected graphs, cyclic loops, memory stress (50 tests)
    ├── tier3_cross_feature/
    │   ├── crawl_to_graph.test.js       # Crawl -> Fit-Markdown -> Knowledge Graph -> Mermaid (6 tests)
    │   ├── doc_to_memory_rag.test.js    # Doc parser -> Chunking -> Hybrid RAG -> Episodic Memory (6 tests)
    │   ├── adaptive_heal_bridge.test.js # Selector mutation -> Adaptive healing -> Bridge fallback cascade (6 tests)
    │   └── dialogue_headroom_persistence.test.js # Multi-turn chat -> Smart crush -> Headroom allocation (6 tests)
    └── tier4_real_world_scenarios/
        ├── academic_researcher.test.js  # End-to-end scientific research journey (1 test)
        ├── competitive_scraper.test.js  # End-to-end competitor price tracking across DOM redesign (1 test)
        ├── knowledge_explorer.test.js   # End-to-end multi-source knowledge base synthesis (1 test)
        └── whatsapp_message_flow.test.js# End-to-end WhatsApp conversational command routing (6 tests)
```

---

## 3. Test Execution Commands

### Run Full E2E Test Suite (All 343 Tests)
```bash
npx jest tests/e2e
```

### Run Tier 1: Feature Coverage (155 Tests)
```bash
npx jest tests/e2e/tier1_feature_coverage
```

### Run Tier 2: Boundary & Corner Cases (155 Tests)
```bash
npx jest tests/e2e/tier2_boundary_corner
```

### Run Tier 3: Cross-Feature Combinations (24 Tests)
```bash
npx jest tests/e2e/tier3_cross_feature
```

### Run Tier 4: Real-World Scenarios (9 Tests)
```bash
npx jest tests/e2e/tier4_real_world_scenarios
```

### Run with Coverage Report
```bash
npx jest tests/e2e --coverage
```

---

## 4. Opaque-Box Methodology & Fixture Strategy

1. **Independent Verification**: Each test suite isolates state in `beforeEach` (e.g. `clearMemory()`, `clearIndex()`, `clearSignatures()`). Tests never depend on execution order or leak state into subsequent tests.
2. **Deterministic Inputs**: `tests/fixtures/samplePages.js` and `sampleDocs.js` provide rich, immutable datasets covering technical articles, product catalogs, tables, and multi-turn dialogue without flaky external HTTP dependencies.
3. **Mock WhatsApp Environment**: `tests/fixtures/mockHelpers.js` simulates Baileys / whatsapp-web.js message objects with message tracking (`replies`, `reactions`), typing status, and contact resolution (`getContact`, `getChat`).
4. **Zero-Facade Guarantee**: All tests call production methods directly (`llmCrawler.htmlToMarkdown`, `ragEngine.retrieve`, `knowledgeGraph.buildGraphFromText`, `persistentMemory.searchIndex`, `adaptiveScraper.adaptiveExtract`). No dummy implementations or facade shortcuts are used.

---

## 5. Known Variances & Escalations

- **Escalated Implementation Bug (FS Utility)**:
  - **Location**: `tests/utils/fsUtil.test.js:81`
  - **Issue**: `writeJson` throws `ENOENT` when writing to a non-existent nested parent directory because `ensureDir` is not called inside `writeJson`.
  - **Escalation**: Escalated to `worker_m1` (Milestone 1 Core implementer) as test writer role strictly prohibits modifying `src/`.
- **Offline AI Fallback**:
  - In unit and CI environments where LLM API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) are not provided, `aiService` and `ragEngine.answerWithRag` gracefully fall back to structured extractive answers with accurate citations without throwing.
