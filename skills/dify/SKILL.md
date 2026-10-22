---
name: dify
description: Declarative Agentic Workflow Engine orchestrating multi-step pipelines (Scrape -> Headroom Compress -> Graphify Knowledge Graph -> RAGFlow Index -> Claude-Mem -> LLM Synthesis).
---

# Dify — Declarative Agentic Workflow Pipelines

Reference Repository: https://github.com/langgenius/dify  
Native Bot Module: `src/services/workflows/workflowEngine.js` (`runWorkflow`, `listWorkflows`, `registerWorkflow`)  
Bot Command: `!workflow <list|run> [workflowId] [query_or_url]`

## Built-in Pipelines
- `deep-research`: Scrape → Headroom Crush → Graphify Knowledge Graph → RAGFlow Index → Memory Save → Executive Synthesis.
- `url-to-rag`: Crawl URL into Fit-Markdown → RAGFlow Chunk & Index → Graphify Knowledge Graph.
- `quick-digest`: Scrape General → Compress Context → Save to Persistent Memory.
