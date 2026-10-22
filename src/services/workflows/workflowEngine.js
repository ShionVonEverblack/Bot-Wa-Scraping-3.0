'use strict';

/**
 * @fileoverview Declarative Agentic Workflow Engine (inspired by langgenius/dify).
 * Executes multi-step pipelines combining Web Crawling (Firecrawl/Crawl4AI),
 * Adaptive Scraping (Scrapling), Context Compression (Headroom), Deep RAG (RAGFlow),
 * Knowledge Graphs (Graphify), Persistent Memory (Claude-Mem), and LLM Synthesis.
 * @module services/workflows/workflowEngine
 */

const config = require('../../config');
const scrapeEngine = require('../../engine/scrapeEngine');
const { scrapeUrlToMarkdown } = require('../../engine/llmCrawler');
const { compressJsonItems, compressText } = require('../compression/contextCompressor');
const ragEngine = require('../rag/ragEngine');
const knowledgeGraph = require('../graph/knowledgeGraph');
const persistentMemory = require('../memory/persistentMemory');
const { createLogger } = require('../monitor/logger');

const log = createLogger('services:workflow');

/** Built-in Dify-style workflow templates. */
const BUILTIN_WORKFLOWS = {
  'deep-research': {
    id: 'deep-research',
    name: 'Deep Research Pipeline',
    description: 'Scrape → Headroom Crush → Graphify Knowledge Graph → RAGFlow Index → Synthesize',
    nodes: [
      { id: 'scrape', type: 'SCRAPE', params: { type: 'papers', limit: 8 } },
      { id: 'compress', type: 'COMPRESS' },
      { id: 'graph', type: 'KNOWLEDGE_GRAPH' },
      { id: 'rag_index', type: 'RAG_INDEX' },
      { id: 'memory', type: 'MEMORY_SAVE', params: { obsType: 'workflow' } },
      { id: 'synthesize', type: 'LLM_SYNTHESIZE' },
    ],
  },
  'url-to-rag': {
    id: 'url-to-rag',
    name: 'URL to RAG & Knowledge Graph',
    description: 'Crawl URL to Fit-Markdown (Firecrawl/Crawl4AI) → RAGFlow Index → Graphify Graph',
    nodes: [
      { id: 'crawl', type: 'CRAWL' },
      { id: 'rag_index', type: 'RAG_INDEX' },
      { id: 'graph', type: 'KNOWLEDGE_GRAPH' },
      { id: 'memory', type: 'MEMORY_SAVE', params: { obsType: 'search' } },
    ],
  },
  'crawl-and-rag': {
    id: 'crawl-and-rag',
    name: 'Crawl & Grounded RAG Q&A',
    description: 'Crawl URL to Fit-Markdown → RAGFlow Index → RAG Grounded Answer → Memory Save',
    nodes: [
      { id: 'crawl', type: 'CRAWL' },
      { id: 'rag_index', type: 'RAG_INDEX' },
      { id: 'rag_query', type: 'RAG_QUERY' },
      { id: 'memory', type: 'MEMORY_SAVE', params: { obsType: 'workflow' } },
    ],
  },
  'fact-check': {
    id: 'fact-check',
    name: 'Multi-Source Fact Check & Graph Verification',
    description: 'Scrape Multi-Source → Compress → RAG Index & Query → Knowledge Graph → Synthesize',
    nodes: [
      { id: 'scrape', type: 'SCRAPE', params: { type: 'general', limit: 6 } },
      { id: 'compress', type: 'COMPRESS' },
      { id: 'rag_index', type: 'RAG_INDEX' },
      { id: 'rag_query', type: 'RAG_QUERY' },
      { id: 'graph', type: 'KNOWLEDGE_GRAPH' },
      { id: 'synthesize', type: 'LLM_SYNTHESIZE' },
    ],
  },
  'quick-digest': {
    id: 'quick-digest',
    name: 'Quick Multi-Source Digest',
    description: 'Scrape General → Compress Context → Save to Persistent Memory',
    nodes: [
      { id: 'scrape', type: 'SCRAPE', params: { type: 'general', limit: 5 } },
      { id: 'compress', type: 'COMPRESS' },
      { id: 'memory', type: 'MEMORY_SAVE', params: { obsType: 'search' } },
    ],
  },
};

/** @type {Map<string, Object>} Custom registered workflows */
const customWorkflows = new Map();

/**
 * List all available workflows (built-in + custom).
 * @returns {Array<{ id: string, name: string, description: string, nodeCount: number }>}
 */
function listWorkflows() {
  const all = [
    ...Object.values(BUILTIN_WORKFLOWS),
    ...Array.from(customWorkflows.values()),
  ];
  return all.map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    nodeCount: Array.isArray(w.nodes) ? w.nodes.length : 0,
  }));
}

/**
 * Register a custom workflow definition.
 * @param {Object} workflowDef
 * @returns {Object}
 */
function registerWorkflow(workflowDef) {
  if (!workflowDef || !workflowDef.id || !Array.isArray(workflowDef.nodes)) {
    throw new Error('Invalid workflow definition: id and nodes[] are required');
  }
  customWorkflows.set(workflowDef.id, workflowDef);
  return workflowDef;
}

/**
 * Optional Dify Workflow API bridge (`POST /v1/workflows/run`) when DIFY_API_KEY is configured.
 * @param {Object} workflow
 * @param {Object} input
 * @returns {Promise<Object|null>}
 */
async function executeViaDifyBridge(workflow, input = {}) {
  const apiKey = input.difyApiKey || config.workflows?.difyApiKey || '';
  const baseUrl = (input.difyBaseUrl || config.workflows?.difyBaseUrl || 'https://api.dify.ai/v1').replace(/\/+$/, '');
  if (!apiKey) return null;

  try {
    const httpClient = require('../../utils/http');
    const res = await httpClient.fetchJson(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          workflow_id: workflow.id,
          query: input.query || input.keyword || '',
          url: input.url || '',
        },
        response_mode: 'blocking',
        user: input.userId || 'bot-wa-user',
      }),
      timeout: 25000,
      retries: 1,
    });
    const outputs = res?.data?.outputs || res?.outputs;
    if (outputs) {
      return {
        workflowId: workflow.id,
        stepsExecuted: ['dify_cloud_workflow'],
        state: {
          query: input.query || '',
          url: input.url || '',
          userId: input.userId || 'anonymous',
          items: [],
          text: outputs.text || outputs.answer || JSON.stringify(outputs),
          synthesis: outputs.text || outputs.answer || JSON.stringify(outputs),
          bridgeUsed: 'dify-api',
        },
        summaryReport: `⚙️ *Workflow Completed via Dify Cloud (${workflow.name})*\n\n${outputs.text || outputs.answer || JSON.stringify(outputs)}`,
      };
    }
  } catch (err) {
    log.debug('Dify API bridge failed, falling back to native workflow DAG engine', { error: err.message });
  }
  return null;
}

/**
 * Execute a workflow by ID or inline definition.
 * @param {string|Object} workflowIdOrDef
 * @param {Object} input
 * @param {string} [input.query] - Keyword or question
 * @param {string} [input.url] - Target URL
 * @param {Array<Object>} [input.items] - Pre-supplied items
 * @param {string} [input.text] - Pre-supplied text
 * @param {string} [input.userId='anonymous']
 * @returns {Promise<{
 *   workflowId: string,
 *   stepsExecuted: string[],
 *   state: Object,
 *   summaryReport: string
 * }>}
 */
async function runWorkflow(workflowIdOrDef, input = {}) {
  const workflow = typeof workflowIdOrDef === 'string'
    ? (customWorkflows.get(workflowIdOrDef) || BUILTIN_WORKFLOWS[workflowIdOrDef])
    : workflowIdOrDef;

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowIdOrDef}`);
  }

  // Optional Dify Cloud API bridge if configured and no local items/custom transforms are required
  if (input.useDifyBridge || (config.workflows?.difyApiKey && !input.items && !workflow.nodes.some(n => n.type === 'TRANSFORM'))) {
    const difyRes = await executeViaDifyBridge(workflow, input);
    if (difyRes) return difyRes;
  }

  const state = {
    query: input.query || input.keyword || '',
    url: input.url || (/^https?:\/\//i.test(input.query || '') ? input.query : ''),
    userId: input.userId || 'anonymous',
    items: Array.isArray(input.items) ? input.items : [],
    text: input.text || '',
    markdown: '',
    compression: null,
    graph: null,
    ragDoc: null,
    ragAnswer: null,
    memoryObservation: null,
    synthesis: '',
  };

  const stepsExecuted = [];

  for (const node of workflow.nodes) {
    const nodeType = (node.type || '').toUpperCase();
    const params = node.params || {};

    switch (nodeType) {
      case 'SCRAPE': {
        if (state.items.length === 0 && state.query) {
          const res = await scrapeEngine.scrape({
            type: params.type || input.type || 'general',
            keyword: state.query,
            limit: params.limit || input.limit || 8,
          });
          state.items = res.items || [];
        }
        stepsExecuted.push(node.id || 'scrape');
        break;
      }

      case 'CRAWL': {
        const targetUrl = state.url || params.url;
        if (targetUrl) {
          const doc = await scrapeUrlToMarkdown(targetUrl, params);
          state.markdown = doc.fitMarkdown || doc.markdown || '';
          state.text = state.markdown;
          state.items = [
            {
              title: doc.title || targetUrl,
              url: targetUrl,
              description: doc.description || state.markdown.slice(0, 300),
              source: `crawler:${doc.bridgeUsed || 'native'}`,
            },
          ];
        }
        stepsExecuted.push(node.id || 'crawl');
        break;
      }

      case 'COMPRESS': {
        if (state.items.length > 0) {
          state.compression = compressJsonItems(state.items, params);
          state.text = state.compression.crushedText;
        } else if (state.text || state.markdown) {
          const comp = compressText(state.text || state.markdown, params);
          state.compression = {
            crushedText: comp.compressedText,
            stats: comp.stats,
          };
          state.text = comp.compressedText;
        }
        stepsExecuted.push(node.id || 'compress');
        break;
      }

      case 'KNOWLEDGE_GRAPH': {
        if (state.items.length > 0) {
          state.graph = knowledgeGraph.buildGraphFromItems(state.items, {
            topic: state.query || state.url || 'Workflow',
          });
        } else if (state.text || state.markdown) {
          state.graph = knowledgeGraph.buildGraphFromText(state.text || state.markdown, {
            title: state.query || state.url || 'Document',
          });
        }
        stepsExecuted.push(node.id || 'graph');
        break;
      }

      case 'RAG_INDEX': {
        const contentToIndex = state.markdown || state.text || state.items.map(i => `${i.title}\n${i.description}`).join('\n\n');
        if (contentToIndex) {
          state.ragDoc = ragEngine.indexDocument(
            `wf_${workflow.id}_${Date.now()}`,
            contentToIndex,
            { title: state.query || state.url || workflow.name }
          );
        }
        stepsExecuted.push(node.id || 'rag_index');
        break;
      }

      case 'RAG_QUERY': {
        if (state.query) {
          state.ragAnswer = await ragEngine.answerWithRag(state.query, {
            docId: state.ragDoc?.docId,
          });
        }
        stepsExecuted.push(node.id || 'rag_query');
        break;
      }

      case 'MEMORY_SAVE': {
        if (state.userId) {
          const summaryTitle = state.query || state.url || workflow.name;
          const summaryContent =
            state.synthesis ||
            state.compression?.crushedText?.slice(0, 400) ||
            state.text?.slice(0, 400) ||
            `Executed workflow ${workflow.id}`;
          state.memoryObservation = persistentMemory.recordObservation(state.userId, {
            type: params.obsType || 'workflow',
            title: `${workflow.name}: ${summaryTitle}`,
            content: summaryContent,
          });
        }
        stepsExecuted.push(node.id || 'memory');
        break;
      }

      case 'LLM_SYNTHESIZE': {
        const promptContext = [
          `Topic: ${state.query || state.url}`,
          state.compression?.crushedText ? `Compressed Data:\n${state.compression.crushedText}` : '',
          state.graph?.godNodes?.length
            ? `Key Concepts: ${state.graph.godNodes.map(n => n.label).join(', ')}`
            : '',
        ].filter(Boolean).join('\n\n');

        try {
          const aiService = require('../ai/aiService');
          state.synthesis = await aiService.chat(
            `Buatkan sintesis eksekutif yang padat dan terstruktur dari hasil riset berikut:\n\n${promptContext}`,
            { maxTokens: 1000 }
          );
        } catch {
          // Offline synthesis fallback
          const topGods = (state.graph?.godNodes || []).map(n => n.label).join(', ') || '-';
          state.synthesis = [
            `📌 *Executive Synthesis (${state.query || state.url}):*`,
            `• Items analyzed: ${state.items.length}`,
            `• Token savings (Headroom): ${state.compression?.stats?.savingsPercent || 0}%`,
            `• Core Concepts (Graphify): ${topGods}`,
            `• RAG Indexed Chunks: ${state.ragDoc?.chunkCount || 0}`,
          ].join('\n');
        }
        stepsExecuted.push(node.id || 'synthesize');
        break;
      }

      case 'TRANSFORM': {
        if (typeof node.fn === 'function') {
          await node.fn(state);
        }
        stepsExecuted.push(node.id || 'transform');
        break;
      }

      default:
        log.warn(`Unknown workflow node type: ${nodeType}`);
    }
  }

  const reportLines = [
    `⚙️ *Workflow Completed: ${workflow.name}* (\`${workflow.id}\`)`,
    `🔗 Steps: ${stepsExecuted.map(s => `\`${s}\``).join(' → ')}`,
  ];

  if (state.items.length > 0) {
    reportLines.push(`📦 Items Processed: *${state.items.length}*`);
  }
  if (state.compression?.stats) {
    reportLines.push(
      `🗜️ Headroom Compression: *${state.compression.stats.originalTokens}* → *${state.compression.stats.compressedTokens}* tokens (*-${state.compression.stats.savingsPercent}%*)`
    );
  }
  if (state.ragDoc) {
    reportLines.push(`📚 RAGFlow Indexed: \`${state.ragDoc.docId}\` (*${state.ragDoc.chunkCount} chunks*)`);
  }
  if (state.graph) {
    const gods = (state.graph.godNodes || []).slice(0, 4).map(g => g.label).join(', ');
    reportLines.push(`🕸️ Graphify: *${state.graph.nodes.length} nodes*, *${state.graph.edges.length} edges* (God Nodes: ${gods || '-'})`);
  }
  if (state.memoryObservation) {
    reportLines.push(`🧠 Claude-Mem Saved: \`${state.memoryObservation.id}\``);
  }
  if (state.synthesis) {
    reportLines.push('', state.synthesis);
  }

  return {
    workflowId: workflow.id,
    stepsExecuted,
    state,
    summaryReport: reportLines.join('\n'),
  };
}

module.exports = {
  BUILTIN_WORKFLOWS,
  listWorkflows,
  registerWorkflow,
  runWorkflow,
};
