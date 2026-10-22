'use strict';

/**
 * @fileoverview Knowledge Graph Builder & Structural Context Analyzer.
 * Inspired by Graphify-Labs/graphify.
 * Turns scraped items, academic papers, or Markdown documents into a queryable
 * Knowledge Graph with God-Node centrality ranking, community clustering,
 * Mermaid diagram generation, and GRAPH_REPORT.md export.
 * @module services/graph/knowledgeGraph
 */

const STOP_ENTITIES = new Set([
  'The', 'This', 'That', 'These', 'Those', 'With', 'From', 'Into', 'For',
  'And', 'But', 'Not', 'Are', 'Was', 'Were', 'Have', 'Has', 'Had', 'Can',
  'Will', 'Yang', 'Dan', 'Dari', 'Untuk', 'Pada', 'Dalam', 'Dengan', 'Ini',
  'Itu', 'Atau', 'Oleh', 'Sebagai', 'Table', 'Figure', 'Section', 'Overview',
  'Results', 'Untitled', 'Http', 'Https',
]);

/**
 * Normalize a node label into a canonical ID.
 * @param {string} label
 * @returns {string}
 */
function normalizeNodeId(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Extract candidate concept/entity phrases from a text passage.
 * @param {string} text
 * @returns {Array<{ label: string, type: string }>}
 */
function extractEntitiesFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const entities = new Map();

  // 1. Extract DOIs / arXiv IDs
  const doiMatches = text.match(/10\.\d{4,9}\/[^\s,;)]+/g) || [];
  for (const doi of doiMatches) {
    entities.set(normalizeNodeId(doi), { label: doi, type: 'identifier' });
  }

  // 2. Extract Title-Case multi-word concepts & technical acronyms (e.g. "Machine Learning", "RAGFlow", "LLM", "GraphRAG")
  const conceptRegex = /\b([A-Z][a-zA-Z0-9_-]{2,}(?:\s+[A-Z][a-zA-Z0-9_-]{2,}){0,2})\b/g;
  let match;
  while ((match = conceptRegex.exec(text)) !== null) {
    const phrase = match[1].trim();
    const firstWord = phrase.split(/\s+/)[0];
    if (STOP_ENTITIES.has(phrase) || STOP_ENTITIES.has(firstWord)) continue;
    if (phrase.length < 3 || phrase.length > 45) continue;

    const id = normalizeNodeId(phrase);
    if (!id) continue;

    const isAcronym = /^[A-Z0-9-]{2,10}$/.test(phrase);
    const existing = entities.get(id);
    entities.set(id, {
      label: existing ? existing.label : phrase,
      type: isAcronym ? 'technology' : 'concept',
      count: (existing?.count || 0) + 1,
    });
  }

  return Array.from(entities.values());
}

/**
 * Compute connected communities and degree centrality (God Nodes) on a graph.
 * @param {Map<string, Object>} nodesMap
 * @param {Map<string, Object>} edgesMap
 * @returns {{
 *   nodes: Object[],
 *   edges: Object[],
 *   godNodes: Object[],
 *   communities: Array<{ clusterId: number, nodes: string[], dominantNode: string }>
 * }}
 */
function finalizeGraph(nodesMap, edgesMap) {
  const adjacency = new Map();
  for (const id of nodesMap.keys()) {
    adjacency.set(id, new Set());
  }

  for (const edge of edgesMap.values()) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }

  // Compute degree centrality
  for (const [id, node] of nodesMap.entries()) {
    node.degree = adjacency.get(id)?.size || 0;
    node.centrality = Number(((node.degree * 1.5 + (node.weight || 1)) / Math.max(1, nodesMap.size)).toFixed(4));
  }

  // Community detection via connected components / local neighborhood clustering
  const visited = new Set();
  const communities = [];
  let clusterId = 1;

  for (const startId of nodesMap.keys()) {
    if (visited.has(startId)) continue;
    const queue = [startId];
    const component = [];
    visited.add(startId);

    while (queue.length > 0) {
      const curr = queue.shift();
      component.push(curr);
      const node = nodesMap.get(curr);
      if (node) node.cluster = clusterId;

      for (const neighbor of adjacency.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length > 0) {
      const sortedMembers = component
        .map(id => nodesMap.get(id))
        .filter(Boolean)
        .sort((a, b) => b.centrality - a.centrality || b.degree - a.degree || b.weight - a.weight);

      communities.push({
        clusterId,
        dominantNode: sortedMembers[0]?.label || startId,
        nodes: sortedMembers.map(n => n.label),
      });
      clusterId++;
    }
  }

  const nodes = Array.from(nodesMap.values()).sort(
    (a, b) => b.centrality - a.centrality || b.degree - a.degree || b.weight - a.weight
  );
  const edges = Array.from(edgesMap.values()).sort((a, b) => b.weight - a.weight);
  const godNodes = nodes.slice(0, 5);

  return {
    nodes,
    edges,
    godNodes,
    communities,
  };
}

/**
 * Build a Knowledge Graph from an array of scraped items (papers, datasets, web results).
 * @param {Array<Object>} items
 * @param {Object} [options]
 * @param {string} [options.topic]
 * @returns {Object}
 */
function buildGraphFromItems(items = [], options = {}) {
  const nodesMap = new Map();
  const edgesMap = new Map();

  function upsertNode(label, type = 'concept', weightDelta = 1) {
    const id = normalizeNodeId(label);
    if (!id) return null;
    const existing = nodesMap.get(id);
    if (existing) {
      existing.weight += weightDelta;
      return existing;
    }
    const created = {
      id,
      label: String(label).trim().slice(0, 60),
      type,
      weight: weightDelta,
      degree: 0,
      cluster: 0,
    };
    nodesMap.set(id, created);
    return created;
  }

  function addEdge(sourceLabel, targetLabel, relation = 'RELATES_TO', confidence = 'EXTRACTED') {
    const src = upsertNode(sourceLabel);
    const tgt = upsertNode(targetLabel);
    if (!src || !tgt || src.id === tgt.id) return;

    const key = [src.id, tgt.id].sort().join('::') + `::${relation}`;
    const existing = edgesMap.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      edgesMap.set(key, {
        source: src.id,
        sourceLabel: src.label,
        target: tgt.id,
        targetLabel: tgt.label,
        relation,
        weight: 1,
        confidence,
      });
    }
  }

  const rootTopic = options.topic ? upsertNode(options.topic, 'topic', 3) : null;

  for (const item of items) {
    const itemTitle = item.title || 'Untitled';
    const itemNode = upsertNode(itemTitle, item.doi ? 'paper' : 'document', 2);
    if (!itemNode) continue;

    if (rootTopic && rootTopic.id !== itemNode.id) {
      addEdge(rootTopic.label, itemNode.label, 'HAS_ITEM', 'EXTRACTED');
    }

    // Source provider relationship
    if (item.source) {
      upsertNode(item.source, 'source', 1);
      addEdge(itemNode.label, item.source, 'SOURCED_FROM', 'EXTRACTED');
    }

    // Authors relationship
    if (item.authors || item.author) {
      const authorList = String(item.authors || item.author)
        .split(/,|;|\band\b/i)
        .map(a => a.trim())
        .filter(a => a.length > 2)
        .slice(0, 3);
      for (const author of authorList) {
        upsertNode(author, 'author', 1);
        addEdge(itemNode.label, author, 'AUTHORED_BY', 'EXTRACTED');
      }
    }

    // Extract concepts from title + description
    const textBlob = `${item.title || ''}. ${item.description || ''}`;
    const concepts = extractEntitiesFromText(textBlob).slice(0, 6);
    for (let i = 0; i < concepts.length; i++) {
      const c = concepts[i];
      upsertNode(c.label, c.type, 1);
      addEdge(itemNode.label, c.label, 'MENTIONS', 'EXTRACTED');
      if (i + 1 < concepts.length) {
        addEdge(c.label, concepts[i + 1].label, 'CO_OCCURS_WITH', 'INFERRED');
      }
    }
  }

  return finalizeGraph(nodesMap, edgesMap);
}

/**
 * Build a Knowledge Graph directly from free-form text or Markdown document.
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.title]
 * @returns {Object}
 */
function buildGraphFromText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return finalizeGraph(new Map(), new Map());
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 20);

  const syntheticItems = paragraphs.map((p, i) => {
    const firstLine = p.split('\n')[0].replace(/^#+\s*/, '').trim();
    return {
      title: firstLine.slice(0, 55) || `Passage ${i + 1}`,
      description: p,
    };
  });

  return buildGraphFromItems(syntheticItems, { topic: options.title });
}

/**
 * Export a Knowledge Graph to a Mermaid.js `flowchart LR` diagram.
 * @param {Object} graph
 * @param {number} [maxEdges=20]
 * @returns {string}
 */
function toMermaid(graph, maxEdges = 20) {
  if (!graph || !Array.isArray(graph.edges) || graph.edges.length === 0) {
    return 'flowchart LR\n  empty["No Graph Data"]';
  }

  const lines = ['flowchart LR'];
  const cleanLabel = (s) => String(s || '').replace(/"/g, "'").replace(/[\[\]()]/g, '');

  for (const edge of graph.edges.slice(0, maxEdges)) {
    const srcId = `n_${edge.source.slice(0, 24)}`;
    const tgtId = `n_${edge.target.slice(0, 24)}`;
    lines.push(
      `  ${srcId}["${cleanLabel(edge.sourceLabel)}"] -->|${edge.relation}| ${tgtId}["${cleanLabel(edge.targetLabel)}"]`
    );
  }

  return lines.join('\n');
}

/**
 * Generate a Graphify-style Markdown report (`GRAPH_REPORT.md` format).
 * @param {Object} graph
 * @returns {string}
 */
function toMarkdownReport(graph) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return '🕸️ *Knowledge Graph kosong.*';
  }

  const godList = (graph.godNodes || [])
    .map((n, i) => `${i + 1}. *${n.label}* (${n.type}, degree: ${n.degree})`)
    .join('\n');

  const clusterList = (graph.communities || [])
    .slice(0, 5)
    .map(c => `• *Cluster #${c.clusterId} (${c.dominantNode}):* ${c.nodes.slice(0, 6).join(', ')}`)
    .join('\n');

  const topRelations = (graph.edges || [])
    .slice(0, 8)
    .map(e => `• \`${e.sourceLabel}\` —[${e.relation}]→ \`${e.targetLabel}\` (${e.confidence})`)
    .join('\n');

  return [
    '🕸️ *GRAPHIFY KNOWLEDGE GRAPH REPORT*',
    `📊 Nodes: *${graph.nodes.length}* | Edges: *${graph.edges.length}* | Communities: *${graph.communities?.length || 0}*`,
    '',
    '🌟 *God Nodes (Highest Centrality):*',
    godList || '-',
    '',
    '🧩 *Topic Communities:*',
    clusterList || '-',
    '',
    '🔗 *Key Structural Relations:*',
    topRelations || '-',
    '',
    '```mermaid',
    toMermaid(graph, 12),
    '```',
  ].join('\n');
}

/**
 * Optional CLI bridge to `graphify` if installed and enabled.
 * Falls back to native `buildGraphFromText`.
 * @param {string} textOrFilePath
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function buildGraphWithCliBridge(textOrFilePath, options = {}) {
  const config = require('../../config');
  const useCli = options.useCliBridge ?? config.graph?.useGraphifyCli ?? false;
  if (useCli) {
    try {
      const { execFile } = require('child_process');
      const cliOut = await new Promise((resolve, reject) => {
        execFile('graphify', [textOrFilePath, '--json'], { timeout: 20000 }, (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });
      if (cliOut && cliOut.trim()) {
        const parsed = JSON.parse(cliOut);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          return { ...parsed, bridgeUsed: 'graphify-cli' };
        }
      }
    } catch {
      // Fallback to native knowledgeGraph builder
    }
  }
  return buildGraphFromText(textOrFilePath, options);
}

module.exports = {
  buildGraphFromItems,
  buildFromItems: buildGraphFromItems,
  buildGraphFromText,
  buildFromText: buildGraphFromText,
  buildGraphWithCliBridge,
  extractEntitiesFromText,
  toMermaid,
  toMarkdownReport,
  toReport: toMarkdownReport,
  normalizeNodeId,
};
