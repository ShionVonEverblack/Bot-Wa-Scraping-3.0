---
name: ragflow
description: Deep document understanding RAG engine with structure-aware chunking, Hybrid Search (BM25 + Vector Cosine Similarity fused via Reciprocal Rank Fusion), and grounded inline citations.
---

# RAGFlow — Deep Document RAG Engine

Reference Repository: https://github.com/infiniflow/ragflow  
Native Bot Module: `src/services/rag/ragEngine.js` (`chunkDocument`, `indexDocument`, `retrieve`, `answerWithRag`)  
Bot Command: `!rag <ingest|ask|stats|clear>`

## Capabilities
- **Structure-Aware Chunking**: Preserves `[Document — Section]` headers on every chunk.
- **Hybrid Search + RRF**: Combines exact BM25 lexical scoring with character-trigram/word vector cosine similarity via Reciprocal Rank Fusion (`k=60`).
- **Grounded Citations**: Generates answers with inline `[1]`, `[2]` citations mapped to exact document sections.
