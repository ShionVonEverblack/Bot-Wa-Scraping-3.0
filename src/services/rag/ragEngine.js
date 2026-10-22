'use strict';

/**
 * @fileoverview Deep Document RAG Engine (inspired by infiniflow/ragflow).
 * Implements template/structure-aware chunking, Hybrid Retrieval (BM25 + TF/Trigram
 * Vector Cosine Similarity fused via Reciprocal Rank Fusion), and grounded citation Q&A.
 * @module services/rag/ragEngine
 */

const config = require('../../config');
const { extractLayoutStructure } = require('../pdf/pdfLoader');
const { createLogger } = require('../monitor/logger');

const log = createLogger('services:rag');

/** @type {Map<string, { docId: string, title: string, chunks: Object[], metadata: Object, createdAt: string }>} */
const documentIndex = new Map();

/** Stopwords for BM25 / token vectorization (EN + ID). */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'what', 'all', 'can', 'will', 'into',
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada',
  'adalah', 'atau', 'dalam', 'juga', 'oleh', 'sebagai', 'tidak', 'bisa', 'ada',
]);

/**
 * Tokenize text into normalized content words.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeWords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Build a sparse character 3-gram + word frequency vector for cosine similarity.
 * @param {string} text
 * @returns {Map<string, number>}
 */
function buildDenseTrigramVector(text) {
  const vec = new Map();
  if (!text || typeof text !== 'string') return vec;

  const words = tokenizeWords(text);
  for (const w of words) {
    const key = `w:${w}`;
    vec.set(key, (vec.get(key) || 0) + 2.0);
    if (w.length >= 3) {
      for (let i = 0; i <= w.length - 3; i++) {
        const tri = `c:${w.slice(i, i + 3)}`;
        vec.set(tri, (vec.get(tri) || 0) + 1.0);
      }
    }
  }
  return vec;
}

/**
 * Compute cosine similarity between two sparse Map vectors.
 * @param {Map<string, number>} vecA
 * @param {Map<string, number>} vecB
 * @returns {number}
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [k, valA] of vecA.entries()) {
    normA += valA * valA;
    const valB = vecB.get(k);
    if (valB) dot += valA * valB;
  }

  for (const valB of vecB.values()) {
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Segment section content into atomic Markdown table blocks and prose segments
 * so tables are never split mid-row across RAG chunks.
 * @param {string} rawContent
 * @returns {Array<{ type: 'table'|'prose', text: string }>}
 */
function splitAtomicTableAndProseBlocks(rawContent) {
  const lines = rawContent.split('\n');
  const blocks = [];
  let proseLines = [];
  let tableLines = [];

  const flushProse = () => {
    const text = proseLines.join('\n').trim();
    if (text) blocks.push({ type: 'prose', text });
    proseLines = [];
  };

  const flushTable = () => {
    const text = tableLines.join('\n').trim();
    if (text) blocks.push({ type: 'table', text });
    tableLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isTableLine = /^\|.*\|$/.test(trimmed);
    if (isTableLine) {
      if (proseLines.length > 0) flushProse();
      tableLines.push(line);
    } else {
      if (tableLines.length > 0) flushTable();
      proseLines.push(line);
    }
  }
  if (tableLines.length > 0) flushTable();
  if (proseLines.length > 0) flushProse();

  return blocks;
}

/**
 * Split a structured document or raw text into structure-aware chunks (RAGFlow style).
 * Preserves section heading prefixes and keeps Markdown tables atomic so chunks remain self-contained.
 * @param {string|Object} docOrText - Raw text/Markdown or output from `pdfLoader`
 * @param {Object} [options]
 * @param {number} [options.chunkSize]
 * @param {number} [options.chunkOverlap]
 * @param {string} [options.docId='doc']
 * @param {string} [options.title='Document']
 * @returns {Array<{
 *   chunkId: string,
 *   docId: string,
 *   title: string,
 *   section: string,
 *   content: string,
 *   rawText: string,
 *   tokens: string[],
 *   vector: Map<string, number>
 * }>}
 */
function chunkDocument(docOrText, options = {}) {
  const chunkSize = options.chunkSize || config.rag?.chunkSize || 800;
  const chunkOverlap = Math.min(
    options.chunkOverlap ?? config.rag?.chunkOverlap ?? 150,
    Math.floor(chunkSize / 2)
  );
  const docId = options.docId || `doc_${Date.now()}`;

  let structured = docOrText;
  if (typeof docOrText === 'string') {
    structured = extractLayoutStructure(docOrText, { title: options.title });
  }

  const title = options.title || structured?.title || 'Document';
  const sections =
    Array.isArray(structured?.sections) && structured.sections.length > 0
      ? structured.sections
      : [{ heading: 'Main', level: 2, content: String(structured?.text || structured?.markdown || '') }];

  const chunks = [];
  let chunkCounter = 1;

  const pushChunk = (sectionName, slice) => {
    const trimmedSlice = (slice || '').trim();
    if (!trimmedSlice) return;
    const contextualContent = `[${title} — ${sectionName}]\n${trimmedSlice}`;
    chunks.push({
      chunkId: `${docId}#c${chunkCounter++}`,
      docId,
      title,
      section: sectionName,
      content: contextualContent,
      rawText: trimmedSlice,
      tokens: tokenizeWords(contextualContent),
      vector: buildDenseTrigramVector(contextualContent),
    });
  };

  for (const sec of sections) {
    const sectionName = sec.heading || 'General';
    const rawContent = (sec.content || '').trim();
    if (!rawContent) continue;

    const blocks = splitAtomicTableAndProseBlocks(rawContent);

    for (const block of blocks) {
      if (block.type === 'table') {
        // Keep entire Markdown table atomic in a single chunk
        pushChunk(sectionName, block.text);
        continue;
      }

      const prose = block.text;
      let cursor = 0;
      while (cursor < prose.length) {
        let end = Math.min(cursor + chunkSize, prose.length);
        if (end < prose.length) {
          // Try to break at newline or period
          const boundary = Math.max(
            prose.lastIndexOf('\n', end),
            prose.lastIndexOf('. ', end)
          );
          if (boundary > cursor + Math.floor(chunkSize * 0.4)) {
            end = boundary + 1;
          }
        }

        pushChunk(sectionName, prose.slice(cursor, end));

        if (end >= prose.length) break;
        cursor = Math.max(cursor + 1, end - chunkOverlap);
      }
    }
  }

  return chunks;
}

/**
 * Index a document into the RAG store.
 * @param {string} docId
 * @param {string|Object} docOrText
 * @param {Object} [options]
 * @returns {{ docId: string, title: string, chunkCount: number }}
 */
function indexDocument(docId, docOrText, options = {}) {
  const id = docId || `doc_${Date.now()}`;
  const chunks = chunkDocument(docOrText, { ...options, docId: id });
  const title = chunks[0]?.title || options.title || id;

  documentIndex.set(id, {
    docId: id,
    title,
    chunks,
    metadata: options.metadata || {},
    createdAt: new Date().toISOString(),
  });

  log.info(`Indexed document "${title}" (${id}) with ${chunks.length} structure-aware chunks`);
  return {
    docId: id,
    title,
    chunkCount: chunks.length,
  };
}

/**
 * Optional RAGFlow HTTP API retrieval bridge when RAGFLOW_API_URL & RAGFLOW_API_KEY are configured.
 * @param {string} query
 * @param {Object} [options]
 * @returns {Promise<Array<Object>|null>}
 */
async function retrieveViaRagflowBridge(query, options = {}) {
  const baseUrl = (options.ragflowBaseUrl || config.rag?.ragflowBaseUrl || '').replace(/\/+$/, '');
  const apiKey = options.ragflowApiKey || config.rag?.ragflowApiKey || '';
  const datasetId = options.ragflowDatasetId || config.rag?.ragflowDatasetId || '';
  if (!baseUrl || !apiKey) return null;

  try {
    const httpClient = require('../../utils/http');
    const res = await httpClient.fetchJson(`${baseUrl}/api/v1/retrieval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        question: query,
        dataset_ids: datasetId ? [datasetId] : undefined,
        top_k: options.topK || config.rag?.topK || 5,
      }),
      timeout: 12000,
      retries: 1,
    });
    const rawChunks = res?.data?.chunks || res?.chunks;
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) return null;

    return rawChunks.map((c, idx) => ({
      chunkId: c.id || `ragflow#c${idx + 1}`,
      docId: c.document_id || 'ragflow',
      title: c.document_keyword || c.docnm_kwd || 'RAGFlow Document',
      section: c.Section || 'RAGFlow',
      content: c.content || c.content_with_weight || '',
      rawText: c.content || c.content_with_weight || '',
      bm25Score: Number(c.term_similarity || 0),
      vectorScore: Number(c.vector_similarity || 0),
      rrfScore: Number(c.similarity || 0),
      citation: `[${idx + 1}]`,
    }));
  } catch (err) {
    log.debug('RAGFlow HTTP bridge failed, falling back to native hybrid RRF retrieval', { error: err.message });
    return null;
  }
}

/**
 * Perform Hybrid Retrieval (BM25 + Dense Trigram Cosine Similarity + Reciprocal Rank Fusion).
 * @param {string} query
 * @param {Object} [options]
 * @param {number} [options.topK]
 * @param {string} [options.docId] - Optional filter by specific document ID
 * @returns {Array<{
 *   chunkId: string,
 *   docId: string,
 *   title: string,
 *   section: string,
 *   content: string,
 *   rawText: string,
 *   bm25Score: number,
 *   vectorScore: number,
 *   rrfScore: number,
 *   citation: string
 * }>}
 */
function retrieve(query, options = {}) {
  const topK = options.topK || config.rag?.topK || 5;
  if (!query || typeof query !== 'string') return [];

  // Collect candidate chunks
  const allChunks = [];
  for (const [id, entry] of documentIndex.entries()) {
    if (options.docId && id !== options.docId) continue;
    allChunks.push(...entry.chunks);
  }

  if (allChunks.length === 0) return [];

  const queryTokens = tokenizeWords(query);
  const queryVec = buildDenseTrigramVector(query);

  // Compute BM25 parameters (k1 = 1.5, b = 0.75)
  const N = allChunks.length;
  const avgDl = allChunks.reduce((acc, c) => acc + (c.tokens.length || 1), 0) / N;
  const k1 = 1.5;
  const b = 0.75;

  // Document frequency per query token
  const df = new Map();
  for (const qt of queryTokens) {
    let count = 0;
    for (const chunk of allChunks) {
      if (chunk.tokens.includes(qt)) count++;
    }
    df.set(qt, count);
  }

  const scored = allChunks.map(chunk => {
    // 1. BM25 score
    let bm25 = 0;
    const dl = chunk.tokens.length || 1;
    const tfMap = new Map();
    for (const t of chunk.tokens) {
      tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }

    for (const qt of queryTokens) {
      const tf = tfMap.get(qt) || 0;
      if (tf === 0) continue;
      const nQt = df.get(qt) || 0;
      const idf = Math.log(1 + (N - nQt + 0.5) / (nQt + 0.5));
      bm25 += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDl))));
    }

    // 2. Vector cosine score
    const vecSim = cosineSimilarity(queryVec, chunk.vector);

    return {
      chunk,
      bm25Score: bm25,
      vectorScore: vecSim,
    };
  });

  // Rank by BM25 and by Vector Similarity, then fuse via Reciprocal Rank Fusion (RRF)
  const byBm25 = [...scored].sort((a, b) => b.bm25Score - a.bm25Score);
  const byVec = [...scored].sort((a, b) => b.vectorScore - a.vectorScore);

  const bm25Rank = new Map();
  byBm25.forEach((item, idx) => bm25Rank.set(item.chunk.chunkId, idx + 1));

  const vecRank = new Map();
  byVec.forEach((item, idx) => vecRank.set(item.chunk.chunkId, idx + 1));

  const rrfK = 60;
  const fused = scored
    .map(item => {
      const rB = bm25Rank.get(item.chunk.chunkId) || N;
      const rV = vecRank.get(item.chunk.chunkId) || N;
      const rrfScore = 1 / (rrfK + rB) + 1 / (rrfK + rV) + (item.bm25Score > 0 ? 0.01 : 0);
      return {
        ...item,
        rrfScore,
      };
    })
    .filter(item => item.bm25Score > 0 || item.vectorScore > 0.05)
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK);

  return fused.map((item, idx) => ({
    chunkId: item.chunk.chunkId,
    docId: item.chunk.docId,
    title: item.chunk.title,
    section: item.chunk.section,
    content: item.chunk.content,
    rawText: item.chunk.rawText,
    bm25Score: Number(item.bm25Score.toFixed(4)),
    vectorScore: Number(item.vectorScore.toFixed(4)),
    rrfScore: Number(item.rrfScore.toFixed(6)),
    citation: `[${idx + 1}]`,
  }));
}

/**
 * Build a grounded prompt with inline citations for LLM RAG synthesis.
 * @param {string} query
 * @param {Array<Object>} retrievedChunks
 * @returns {string}
 */
function buildGroundedPrompt(query, retrievedChunks = []) {
  const contextBlocks = retrievedChunks
    .map(c => `${c.citation} (${c.title} — Section: ${c.section}):\n${c.rawText}`)
    .join('\n\n---\n\n');

  return [
    'Anda adalah asisten Deep RAG (Retrieval-Augmented Generation).',
    'Jawablah pertanyaan pengguna HANYA berdasarkan konteks dokumen di bawah ini.',
    'Sertakan sitasi inline seperti [1], [2] pada setiap klaim penting.',
    '',
    '=== KONTEKS DOKUMEN ===',
    contextBlocks || '(Tidak ada konteks yang relevan)',
    '=======================',
    '',
    `Pertanyaan: ${query}`,
  ].join('\n');
}

/**
 * Answer a question using the RAG index (or optional RAGFlow HTTP bridge),
 * with automatic extractive fallback if no LLM key is set.
 * @param {string} query
 * @param {Object} [options]
 * @returns {Promise<{ answer: string, citations: Array<Object> }>}
 */
async function answerWithRag(query, options = {}) {
  let hits = await retrieveViaRagflowBridge(query, options);
  if (!hits || hits.length === 0) {
    hits = retrieve(query, options);
  }
  if (hits.length === 0) {
    return {
      answer: 'Tidak ditemukan potongan dokumen yang relevan di dalam indeks RAG.',
      citations: [],
    };
  }

  const prompt = buildGroundedPrompt(query, hits);

  try {
    const aiService = require('../ai/aiService');
    const llmAnswer = await aiService.chat(prompt, { maxTokens: 1200 });
    return {
      answer: llmAnswer,
      citations: hits,
    };
  } catch {
    // Graceful extractive synthesis when no AI provider key is configured
    const summaryLines = hits.map(
      h => `• ${h.citation} *[${h.title} — ${h.section}]*: ${h.rawText.slice(0, 300)}`
    );
    return {
      answer: `📚 *Hasil Ekstraksi RAG (Grounded Citations):*\n\n${summaryLines.join('\n\n')}`,
      citations: hits,
    };
  }
}

/**
 * Get statistics about the current RAG index.
 * @returns {{ totalDocuments: number, totalChunks: number, documents: Array<{docId: string, title: string, chunkCount: number}> }}
 */
function getStats() {
  let totalChunks = 0;
  const documents = [];
  for (const entry of documentIndex.values()) {
    totalChunks += entry.chunks.length;
    documents.push({
      docId: entry.docId,
      title: entry.title,
      chunkCount: entry.chunks.length,
    });
  }
  return {
    totalDocuments: documentIndex.size,
    totalChunks,
    documents,
  };
}

/**
 * Clear all indexed documents from the RAG engine.
 */
function clearIndex() {
  documentIndex.clear();
}

module.exports = {
  chunkDocument,
  structureAwareChunk: chunkDocument,
  indexDocument,
  retrieve,
  retrieveViaRagflowBridge,
  buildGroundedPrompt,
  answerWithRag,
  ask: answerWithRag,
  getStats,
  clearIndex,
  tokenizeWords,
  cosineSimilarity,
};
