---
name: graphify
description: Turn any corpus of papers, scraped items, or documents into a queryable Knowledge Graph with God-Node centrality scoring, community clustering, and Mermaid diagrams.
---

# Graphify — Structural Knowledge Graph & God-Node Analysis

Reference Repository: https://github.com/Graphify-Labs/graphify  
Native Bot Module: `src/services/graph/knowledgeGraph.js` (`buildGraphFromItems`, `buildGraphFromText`, `toMermaid`, `toMarkdownReport`)  
Bot Command: `!graph <keyword|url|jobId>`

## Capabilities
- Extracts concepts, technologies, authors, sources, and typed relations (`EXTRACTED` and `INFERRED`).
- Ranks **God Nodes** by degree centrality and detects topic communities/clusters.
- Exports interactive Mermaid `flowchart LR` diagrams and `GRAPH_REPORT.md` summaries.
