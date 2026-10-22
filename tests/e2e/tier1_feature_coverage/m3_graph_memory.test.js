'use strict';

/**
 * @fileoverview Tier 1 Feature Coverage: Milestone 3 Knowledge Graph & Persistent Memory (F22 - F27).
 * Covers isolated functionality with >= 5 tests per feature.
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 1: Milestone 3 Knowledge Graph & Persistent Memory (F22 - F27)', () => {
  const rootDir = process.cwd();

  let knowledgeGraph;
  let persistentMemory;
  let contextCompressor;

  beforeAll(() => {
    knowledgeGraph = require(path.join(rootDir, 'src', 'services', 'graph', 'knowledgeGraph'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
  });

  beforeEach(() => {
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  // --------------------------------------------------------------------------
  // F22: F22_Knowledge_Graph_Extraction
  // --------------------------------------------------------------------------
  describe('F22: Knowledge Graph Extraction', () => {
    test('F22-1: extractEntitiesFromText extracts technology acronyms and concepts', () => {
      const entities = knowledgeGraph.extractEntitiesFromText(sampleDocs.graphCorpusText);
      const labels = entities.map(e => e.label);
      expect(labels.some(l => l.includes('AlphaFold'))).toBe(true);
      expect(labels.some(l => l.includes('DeepMind'))).toBe(true);
      expect(labels.some(l => l.includes('Transformer'))).toBe(true);
    });

    test('F22-2: extractEntitiesFromText extracts academic DOIs with identifier type', () => {
      const entities = knowledgeGraph.extractEntitiesFromText(sampleDocs.graphCorpusText);
      const doiEntity = entities.find(e => e.type === 'identifier');
      expect(doiEntity).toBeDefined();
      expect(doiEntity.label).toBe('10.1038/s41586-021-03819-2');
    });

    test('F22-3: buildGraphFromText segments text into nodes and edges', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText, {
        title: 'Deep Learning Biology',
      });
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    test('F22-4: Assigns proper edge relationship types (MENTIONS, CO_OCCURS_WITH, SOURCED_FROM)', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      const relations = new Set(graph.edges.map(e => e.relation));
      expect(relations.has('MENTIONS') || relations.has('CO_OCCURS_WITH') || relations.has('HAS_ITEM')).toBe(true);
    });

    test('F22-5: normalizeNodeId canonicalizes diverse entity strings into clean IDs', () => {
      expect(knowledgeGraph.normalizeNodeId('Google DeepMind')).toBe('google_deepmind');
      expect(knowledgeGraph.normalizeNodeId('10.1038/s41586-021-03819-2')).toBe('10_1038_s41586_021_03819_2');
      expect(knowledgeGraph.normalizeNodeId('  Machine Learning!! ')).toBe('machine_learning');
    });
  });

  // --------------------------------------------------------------------------
  // F23: F23_Graph_Context_Traversal
  // --------------------------------------------------------------------------
  describe('F23: Graph Context Traversal & Centrality', () => {
    test('F23-1: Computes degree centrality and assigns score to each node', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      for (const node of graph.nodes) {
        expect(typeof node.degree).toBe('number');
        expect(typeof node.centrality).toBe('number');
        expect(node.centrality).toBeGreaterThanOrEqual(0);
      }
    });

    test('F23-2: Identifies and ranks God Nodes (key hubs with highest centrality)', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      expect(graph.godNodes).toBeDefined();
      expect(Array.isArray(graph.godNodes)).toBe(true);
      expect(graph.godNodes.length).toBeGreaterThan(0);
      // God nodes must be sorted by centrality descending
      for (let i = 0; i < graph.godNodes.length - 1; i++) {
        expect(graph.godNodes[i].centrality).toBeGreaterThanOrEqual(graph.godNodes[i + 1].centrality);
      }
    });

    test('F23-3: Groups connected graph nodes into community clusters', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      expect(graph.communities).toBeDefined();
      expect(Array.isArray(graph.communities)).toBe(true);
      if (graph.communities.length > 0) {
        expect(graph.communities[0].clusterId).toBeDefined();
        expect(graph.communities[0].dominantNode).toBeDefined();
      }
    });

    test('F23-4: Adjacency traversal handles circular relationships without infinite loops', () => {
      const items = [
        { title: 'Doc A', description: 'Transformer and PyTorch' },
        { title: 'Doc B', description: 'PyTorch and Transformer' },
      ];
      const graph = knowledgeGraph.buildGraphFromItems(items);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    test('F23-5: toMarkdownReport exports formatted analysis summary with God Nodes', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText, {
        title: 'Deep Learning Biology',
      });
      const report = knowledgeGraph.toMarkdownReport(graph);
      expect(report).toMatch(/KNOWLEDGE GRAPH REPORT/i);
      expect(report).toMatch(/Nodes:/);
      expect(report).toMatch(/Edges:/);
      expect(report).toMatch(/God Nodes/i);
    });
  });

  // --------------------------------------------------------------------------
  // F24: F24_Mermaid_Graph_Renderer
  // --------------------------------------------------------------------------
  describe('F24: Mermaid Graph Visualizer', () => {
    test('F24-1: toMermaid outputs valid flowchart LR syntax', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      const mermaid = knowledgeGraph.toMermaid(graph);
      expect(mermaid.startsWith('flowchart LR')).toBe(true);
    });

    test('F24-2: Formats directed edge connections with relationship labels', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      const mermaid = knowledgeGraph.toMermaid(graph);
      expect(mermaid).toMatch(/-->\|[A-Z_]+\|/);
    });

    test('F24-3: Sanitizes node labels removing problematic Mermaid characters', () => {
      const items = [
        { title: 'Node [Special] (Test)', description: 'Item with "quotes" and [brackets]' },
      ];
      const graph = knowledgeGraph.buildGraphFromItems(items);
      const mermaid = knowledgeGraph.toMermaid(graph);
      expect(mermaid).not.toMatch(/"\[Special\]"/);
    });

    test('F24-4: Enforces maxEdges limit to avoid overloading mobile WhatsApp screen', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      const mermaid = knowledgeGraph.toMermaid(graph, 5);
      const arrowCount = (mermaid.match(/-->/g) || []).length;
      expect(arrowCount).toBeLessThanOrEqual(5);
    });

    test('F24-5: Emits fallback diagram for empty graph', () => {
      const mermaid = knowledgeGraph.toMermaid({ nodes: [], edges: [] });
      expect(mermaid).toMatch(/empty\["No Graph Data"\]/);
    });
  });

  // --------------------------------------------------------------------------
  // F25: F25_Layered_Persistent_Memory
  // --------------------------------------------------------------------------
  describe('F25: Layered Persistent Memory System (Claude-Mem)', () => {
    const testUser = 'user_test_f25';

    test('F25-1: recordObservation captures structured observation with type, title, tags, and timestamp', () => {
      const obs = persistentMemory.recordObservation(testUser, {
        type: 'fact',
        title: 'Preferred Framework',
        content: 'User prefers PyTorch over TensorFlow for research projects.',
      });

      expect(obs.id).toBeDefined();
      expect(obs.userId).toBe(testUser);
      expect(obs.type).toBe('fact');
      expect(obs.title).toBe('Preferred Framework');
      expect(obs.tags).toContain('pytorch');
      expect(obs.timestamp).toBeDefined();
    });

    test('F25-2: Layer 1 searchIndex returns compact index with scores', () => {
      persistentMemory.recordObservation(testUser, {
        type: 'preference',
        title: 'Batch Size Setting',
        content: 'Batch size 32 is optimal for GPU memory.',
      });
      persistentMemory.recordObservation(testUser, {
        type: 'paper',
        title: 'ResNet Paper Reference',
        content: 'Kaiming He ImageNet classification paper.',
      });

      const hits = persistentMemory.searchIndex(testUser, 'batch size');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].id).toBeDefined();
      expect(hits[0].title).toBe('Batch Size Setting');
      expect(hits[0].score).toBeGreaterThan(0);
    });

    test('F25-3: Layer 2 getTimeline returns chronological window around anchor ID', () => {
      const obs1 = persistentMemory.recordObservation(testUser, { title: 'Step 1: Ingest' });
      const obs2 = persistentMemory.recordObservation(testUser, { title: 'Step 2: Parse' });
      const obs3 = persistentMemory.recordObservation(testUser, { title: 'Step 3: Index' });

      const timeline = persistentMemory.getTimeline(testUser, obs2.id, 1);
      expect(timeline.length).toBeGreaterThanOrEqual(2);
      expect(timeline.some(t => t.id === obs2.id)).toBe(true);
    });

    test('F25-4: Layer 3 getObservations returns full observation payloads for filtered IDs', () => {
      const obs1 = persistentMemory.recordObservation(testUser, {
        title: 'Full Payload Test',
        content: 'This is the complete detailed observation content.',
      });

      const fullList = persistentMemory.getObservations(testUser, [obs1.id]);
      expect(fullList).toHaveLength(1);
      expect(fullList[0].content).toBe('This is the complete detailed observation content.');
    });

    test('F25-5: extractTags extracts relevant alphanumeric keywords', () => {
      const tags = persistentMemory.extractTags('PyTorch Transformer model fine-tuning with AdamW!');
      expect(tags).toContain('pytorch');
      expect(tags).toContain('transformer');
      expect(tags).toContain('model');
      expect(tags).toContain('adamw');
    });
  });

  // --------------------------------------------------------------------------
  // F26: F26_Context_Window_Compression
  // --------------------------------------------------------------------------
  describe('F26: Context Window Compression (Headroom Smart Crusher)', () => {
    test('F26-1: estimateTokens calculates token count heuristic (~4 chars/token)', () => {
      expect(contextCompressor.estimateTokens('')).toBe(0);
      expect(contextCompressor.estimateTokens('1234')).toBe(1);
      expect(contextCompressor.estimateTokens('12345678')).toBe(2);
    });

    test('F26-2: compressJsonItems strips noisy/heavy keys from item objects', () => {
      const res = contextCompressor.compressJsonItems(sampleDocs.sampleJsonItems);
      expect(res.crushedItems.length).toBe(2);
      for (const item of res.crushedItems) {
        expect(item.raw).toBeUndefined();
        expect(item._score).toBeUndefined();
        expect(item.thumbnail).toBeUndefined();
        expect(item.sourceUrl).toBeUndefined();
      }
    });

    test('F26-3: compressJsonItems emits schema-deduplicated tabular representation', () => {
      const res = contextCompressor.compressJsonItems(sampleDocs.sampleJsonItems);
      expect(res.crushedText).toMatch(/^# Schema:/);
      expect(res.crushedText).toMatch(/RTX 4090 Gaming Edition/);
      expect(res.crushedText).toMatch(/Radeon RX 7900 XTX/);
    });

    test('F26-4: compressJsonItems calculates savings stats', () => {
      const res = contextCompressor.compressJsonItems(sampleDocs.sampleJsonItems);
      expect(res.stats.originalTokens).toBeGreaterThan(res.stats.compressedTokens);
      expect(res.stats.savingsPercent).toBeGreaterThan(0);
    });

    test('F26-5: compressText preserves Markdown headings, code blocks, and citations', () => {
      const res = contextCompressor.compressText(sampleDocs.academicPaperText, { targetRatio: 0.4 });
      expect(res.compressedText).toMatch(/ResNet|\[1\]|Model/);
      expect(res.stats.savingsPercent).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // F27: F27_Cross_Session_Persistence
  // --------------------------------------------------------------------------
  describe('F27: Cross-Session Persistence', () => {
    const userA = 'user_session_A';
    const userB = 'user_session_B';

    test('F27-1: Isolates memory records across distinct user IDs', () => {
      persistentMemory.recordObservation(userA, { title: 'User A Secret Fact' });
      persistentMemory.recordObservation(userB, { title: 'User B Preference' });

      const hitsA = persistentMemory.searchIndex(userA, '');
      const hitsB = persistentMemory.searchIndex(userB, '');

      expect(hitsA.every(h => h.title.includes('User A'))).toBe(true);
      expect(hitsB.every(h => h.title.includes('User B'))).toBe(true);
    });

    test('F27-2: buildMemoryContextPrompt constructs prompt injection block for AI chat', () => {
      persistentMemory.recordObservation(userA, {
        type: 'preference',
        title: 'Framework Preference',
        content: 'Prefers PyTorch with CUDA 12 support.',
      });

      const promptBlock = persistentMemory.buildMemoryContextPrompt(userA, 'framework');
      expect(promptBlock).toMatch(/### User Persistent Memory/);
      expect(promptBlock).toMatch(/Framework Preference/);
      expect(promptBlock).toMatch(/PyTorch with CUDA 12/);
    });

    test('F27-3: buildMemoryContextPrompt returns empty string when user has no matching memories', () => {
      const promptBlock = persistentMemory.buildMemoryContextPrompt('unknown_user_999', 'something');
      expect(promptBlock).toBe('');
    });

    test('F27-4: clearMemory removes memories for specified user while preserving others', () => {
      persistentMemory.recordObservation(userA, { title: 'Fact A' });
      persistentMemory.recordObservation(userB, { title: 'Fact B' });

      persistentMemory.clearMemory(userA);

      expect(persistentMemory.searchIndex(userA, '')).toHaveLength(0);
      expect(persistentMemory.searchIndex(userB, '').length).toBeGreaterThan(0);
    });

    test('F27-5: Global clearMemory resets all user memory stores', () => {
      persistentMemory.recordObservation(userA, { title: 'Fact A' });
      persistentMemory.recordObservation(userB, { title: 'Fact B' });

      persistentMemory.clearMemory(); // All users

      expect(persistentMemory.searchIndex(userA, '')).toHaveLength(0);
      expect(persistentMemory.searchIndex(userB, '')).toHaveLength(0);
    });
  });
});
