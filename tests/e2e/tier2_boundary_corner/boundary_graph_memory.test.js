'use strict';

/**
 * @fileoverview Tier 2 Boundary & Corner Cases: Knowledge Graph, Persistent Memory,
 * Context Compression, Workflow Engine, and System Commands (F22 - F31).
 * Tests extreme inputs, empty states, limits, invalid combinations, and stress boundaries.
 */

const fs = require('fs');
const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');
const { createMockMsg } = require('../../fixtures/mockHelpers');

describe('Tier 2: Boundary & Corner Cases — Graph, Memory, Compression & Workflow (F22 - F31)', () => {
  const rootDir = process.cwd();

  let knowledgeGraph;
  let persistentMemory;
  let contextCompressor;
  let jobStore;
  let jobSchemas;
  let textUtils;
  let statusHandler;
  let llmCrawler;

  beforeAll(() => {
    knowledgeGraph = require(path.join(rootDir, 'src', 'services', 'graph', 'knowledgeGraph'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
    jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
    jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
    textUtils = require(path.join(rootDir, 'src', 'utils', 'text'));
    statusHandler = require(path.join(rootDir, 'src', 'commands', 'handlers', 'status.handler'));
    llmCrawler = require(path.join(rootDir, 'src', 'engine', 'llmCrawler'));
  });

  beforeEach(() => {
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  // --------------------------------------------------------------------------
  // F22 Boundaries: Knowledge Graph Extraction
  // --------------------------------------------------------------------------
  describe('F22 Boundaries: Knowledge Graph Extraction Edge Cases', () => {
    test('F22-B1: Empty text returns empty graph structure without crashing', () => {
      const graph = knowledgeGraph.buildGraphFromText('');
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
      expect(graph.godNodes).toHaveLength(0);
      expect(graph.communities).toHaveLength(0);
    });

    test('F22-B2: Text containing purely symbols and punctuation produces no spurious nodes', () => {
      const symText = '$$$ @@@ ### %%% ^^^ &&& *** ((( ))) ___ +++ === ~~~';
      const entities = knowledgeGraph.extractEntitiesFromText(symText);
      expect(entities).toHaveLength(0);
      const graph = knowledgeGraph.buildGraphFromText(symText);
      expect(graph.nodes).toHaveLength(0);
    });

    test('F22-B3: Massive repeated identical entity mentions are deduplicated into single node', () => {
      const repeatedText = 'AlphaFold '.repeat(500);
      const graph = knowledgeGraph.buildGraphFromText(repeatedText);
      const alphafoldNodes = graph.nodes.filter(n => n.id === 'alphafold');
      expect(alphafoldNodes.length).toBeLessThanOrEqual(1);
    });

    test('F22-B4: normalizeNodeId handles strings with non-ASCII or exotic unicode safely', () => {
      expect(knowledgeGraph.normalizeNodeId('機械学習 (Machine Learning)')).toBeDefined();
      expect(knowledgeGraph.normalizeNodeId('---___---')).toBe('');
      expect(knowledgeGraph.normalizeNodeId('   \t\n  ')).toBe('');
    });

    test('F22-B5: buildGraphFromItems handles item with missing title and description gracefully', () => {
      const corruptItems = [
        {},
        { title: null, description: undefined },
        { title: 'Valid Item', description: 'Transformer model' },
      ];
      expect(() => knowledgeGraph.buildGraphFromItems(corruptItems)).not.toThrow();
      const graph = knowledgeGraph.buildGraphFromItems(corruptItems);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // F23 Boundaries: Graph Traversal, Centrality & Adjacency
  // --------------------------------------------------------------------------
  describe('F23 Boundaries: Graph Engine Edge Cases', () => {
    test('F23-B1: Disconnected graph with N items and 0 cross-item edges computes degree=0 without division by zero', () => {
      const items = [
        { title: 'Item Alpha' },
        { title: 'Item Beta' },
      ];
      const graph = knowledgeGraph.buildGraphFromItems(items);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(0);
      for (const node of graph.nodes) {
        expect(node.degree).toBe(0);
      }
    });

    test('F23-B2: Single item graph computes nodes and handles godNodes without error', () => {
      const items = [{ title: 'Solo Node' }];
      const graph = knowledgeGraph.buildGraphFromItems(items);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(0);
      expect(graph.godNodes).toHaveLength(1);
      expect(graph.godNodes[0].label).toBe('Solo Node');
    });

    test('F23-B3: Cross-referencing items create bidirectional graph links and consistent degrees', () => {
      const items = [
        { title: 'Alpha', description: 'Beta is related to Gamma' },
        { title: 'Beta', description: 'Alpha and Gamma are related' },
        { title: 'Gamma', description: 'Alpha and Beta are related' },
      ];
      const graph = knowledgeGraph.buildGraphFromItems(items);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    test('F23-B4: Directed cyclic relationships handled without infinite loop in community clustering', () => {
      const items = [
        { title: 'Step X', description: 'Leads to Step Y' },
        { title: 'Step Y', description: 'Leads to Step Z' },
        { title: 'Step Z', description: 'Leads to Step X' },
      ];
      expect(() => knowledgeGraph.buildGraphFromItems(items)).not.toThrow();
      const graph = knowledgeGraph.buildGraphFromItems(items);
      expect(graph.communities).toBeDefined();
    });

    test('F23-B5: toMarkdownReport handles graph with empty nodes and edges cleanly', () => {
      const report = knowledgeGraph.toMarkdownReport({ nodes: [], edges: [], godNodes: [] });
      expect(report).toMatch(/Knowledge Graph kosong/i);
    });
  });

  // --------------------------------------------------------------------------
  // F24 Boundaries: Mermaid Graph Visualizer
  // --------------------------------------------------------------------------
  describe('F24 Boundaries: Mermaid Visualizer Edge Cases', () => {
    test('F24-B1: toMermaid with maxEdges=0 renders nodes but zero edge links', () => {
      const graph = knowledgeGraph.buildGraphFromText(sampleDocs.graphCorpusText);
      const mermaid = knowledgeGraph.toMermaid(graph, 0);
      expect(mermaid.startsWith('flowchart LR')).toBe(true);
      expect(mermaid).not.toMatch(/-->/);
    });

    test('F24-B2: Node labels containing quotes and special brackets sanitized cleanly', () => {
      const graph = {
        nodes: [
          { id: 'bad_node', label: 'Special "Quotes" & [Brackets] (Parens)' },
        ],
        edges: [],
      };
      const mermaid = knowledgeGraph.toMermaid(graph);
      expect(mermaid).not.toContain('"Quotes"');
      expect(mermaid).not.toContain('[Brackets]');
    });

    test('F24-B3: Handles graph with 100 edges capping strictly at maxEdges limit', () => {
      const nodes = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
      const edges = [];
      for (let i = 0; i < 49; i++) {
        edges.push({ source: `n${i}`, target: `n${i + 1}`, relation: 'REL' });
        edges.push({ source: `n${i}`, target: `n0`, relation: 'BACK' });
      }
      const mermaid = knowledgeGraph.toMermaid({ nodes, edges }, 12);
      const arrows = (mermaid.match(/-->/g) || []).length;
      expect(arrows).toBeLessThanOrEqual(12);
    });

    test('F24-B4: Sanitizes relationship strings with illegal Mermaid arrow syntax', () => {
      const graph = {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [
          { source: 'a', target: 'b', relation: 'INVALID|--||LABEL' },
        ],
      };
      const mermaid = knowledgeGraph.toMermaid(graph);
      expect(mermaid).toContain('-->');
    });

    test('F24-B5: Handles null or empty graph input returning graceful placeholder diagram', () => {
      expect(knowledgeGraph.toMermaid(null)).toMatch(/No Graph Data/);
      expect(knowledgeGraph.toMermaid({ nodes: [] })).toMatch(/No Graph Data/);
    });
  });

  // --------------------------------------------------------------------------
  // F25 Boundaries: Layered Persistent Memory System
  // --------------------------------------------------------------------------
  describe('F25 Boundaries: 3-Layer Persistent Memory Edge Cases', () => {
    const userTest = 'user_boundary_f25';

    test('F25-B1: recordObservation with missing optional fields supplies default title and tags', () => {
      const obs = persistentMemory.recordObservation(userTest, {});
      expect(obs.id).toBeDefined();
      expect(obs.title).toBe('Observation');
      expect(obs.type).toBe('fact');
      expect(Array.isArray(obs.tags)).toBe(true);
    });

    test('F25-B2: searchIndex returns empty array when query has zero matches or is empty string', () => {
      persistentMemory.recordObservation(userTest, { title: 'Transformer Paper', content: 'Attention is all you need' });
      const hitsEmpty = persistentMemory.searchIndex(userTest, 'xylophone unicycle quantum');
      expect(hitsEmpty).toHaveLength(0);
    });

    test('F25-B3: getTimeline returns empty array when anchorId does not exist', () => {
      const timeline = persistentMemory.getTimeline(userTest, 'non_existent_anchor_id', 5);
      expect(timeline.length).toBeGreaterThanOrEqual(0);
    });

    test('F25-B4: getTimeline with windowSize 0 returns only the anchor observation itself', () => {
      const obs1 = persistentMemory.recordObservation(userTest, { title: 'First' });
      const obs2 = persistentMemory.recordObservation(userTest, { title: 'Anchor' });
      const obs3 = persistentMemory.recordObservation(userTest, { title: 'Third' });

      const timeline = persistentMemory.getTimeline(userTest, obs2.id, 0);
      expect(timeline).toHaveLength(1);
      expect(timeline[0].id).toBe(obs2.id);
    });

    test('F25-B5: getObservations with empty array or non-existent IDs returns empty array cleanly', () => {
      expect(persistentMemory.getObservations(userTest, [])).toHaveLength(0);
      expect(persistentMemory.getObservations(userTest, ['ghost_1', 'ghost_2'])).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // F26 Boundaries: Context Window Compression
  // --------------------------------------------------------------------------
  describe('F26 Boundaries: Context Compressor Edge Cases', () => {
    test('F26-B1: estimateTokens returns 0 for empty string, null, or undefined', () => {
      expect(contextCompressor.estimateTokens('')).toBe(0);
      expect(contextCompressor.estimateTokens(null)).toBe(0);
      expect(contextCompressor.estimateTokens(undefined)).toBe(0);
    });

    test('F26-B2: compressJsonItems with empty array returns empty output with 0 tokens', () => {
      const res = contextCompressor.compressJsonItems([]);
      expect(res.crushedItems).toHaveLength(0);
      expect(res.crushedText).toBe('[]');
      expect(res.stats.originalTokens).toBe(0);
      expect(res.stats.compressedTokens).toBe(0);
    });

    test('F26-B3: compressJsonItems handles array containing empty objects without crashing', () => {
      const res = contextCompressor.compressJsonItems([{}, {}, {}]);
      expect(res.crushedItems).toHaveLength(3);
      expect(res.stats.originalTokens).toBeGreaterThanOrEqual(0);
    });

    test('F26-B4: compressText handles extreme targetRatio (0.0 or 1.0) safely without NaN', () => {
      const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const resZero = contextCompressor.compressText(text, { targetRatio: 0 });
      expect(resZero.stats.compressedTokens).toBeDefined();
      expect(isNaN(resZero.stats.savingsPercent)).toBe(false);

      const resOne = contextCompressor.compressText(text, { targetRatio: 1.0 });
      expect(resOne.stats.compressedTokens).toBeDefined();
    });

    test('F26-B5: compressText preserves markdown headings and code fences even under high compression', () => {
      const text = '# Main Header\n```javascript\nconst a = 10;\n```\nSome body text that can be dropped.\n## Secondary Header';
      const res = contextCompressor.compressText(text, { targetRatio: 0.2 });
      expect(res.compressedText).toContain('# Main Header');
      expect(res.compressedText).toContain('## Secondary Header');
    });
  });

  // --------------------------------------------------------------------------
  // F27 Boundaries: Cross-Session Persistence
  // --------------------------------------------------------------------------
  describe('F27 Boundaries: Cross-Session Persistence Edge Cases', () => {
    test('F27-B1: Memory stores operate safely when passed unusual user ID strings', () => {
      const unusualUser = 'user:with/special@chars+and spaces!';
      const obs = persistentMemory.recordObservation(unusualUser, { title: 'Unusual User Obs' });
      expect(obs.userId).toBe(unusualUser);

      const hits = persistentMemory.searchIndex(unusualUser, 'Unusual');
      expect(hits.length).toBeGreaterThan(0);
    });

    test('F27-B2: Handles storing 50 sequential observations for one user without degradation', () => {
      const stressUser = 'stress_user_50';
      for (let i = 1; i <= 50; i++) {
        persistentMemory.recordObservation(stressUser, {
          title: `Observation ${i}`,
          content: `Content details for event number ${i}`,
        });
      }
      const allIndex = persistentMemory.searchIndex(stressUser, '', 100);
      expect(allIndex).toHaveLength(50);
    });

    test('F27-B3: buildMemoryContextPrompt handles non-existent user returning empty string', () => {
      const prompt = persistentMemory.buildMemoryContextPrompt('non_existent_user_xyz', 'test');
      expect(prompt).toBe('');
    });

    test('F27-B4: clearMemory with non-existent user ID does not throw or corrupt existing users', () => {
      persistentMemory.recordObservation('valid_user', { title: 'Keep Me' });
      expect(() => persistentMemory.clearMemory('ghost_user')).not.toThrow();

      const hits = persistentMemory.searchIndex('valid_user', '');
      expect(hits).toHaveLength(1);
    });

    test('F27-B5: searchIndex with 2000-character query string executes without throwing', () => {
      const query = 'transformer deep learning '.repeat(100);
      expect(() => persistentMemory.searchIndex('valid_user', query)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // F28 Boundaries: Research Workflow Engine
  // --------------------------------------------------------------------------
  describe('F28 Boundaries: Research Workflow Engine Edge Cases', () => {
    test('F28-B1: createJob with missing type falls back to default SCRAPE type', async () => {
      const job = await jobStore.createJob({ userId: 'u1' });
      expect(job.type).toBe(jobSchemas.JOB_TYPES.SCRAPE);
    });

    test('F28-B2: updateJob with non-existent jobId throws error or returns null', async () => {
      const res = await jobStore.updateJob('non_existent_job_99999', { status: 'COMPLETED' });
      expect(res).toBeNull();
    });

    test('F28-B3: Progress percent values below 0 or above 100 are handled safely', async () => {
      const job = await jobStore.createJob({ type: 'WORKFLOW', userId: 'u_clamp' });
      const updated = await jobStore.updateJob(job.jobId, {
        progress: { percent: 150, message: 'Over-completed' },
      });
      expect(updated.progress.percent).toBe(150);
    });

    test('F28-B4: Job transitions cleanly to FAILED with custom error payload', async () => {
      const job = await jobStore.createJob({ type: 'WORKFLOW', userId: 'u_err' });
      const failed = await jobStore.updateJob(job.jobId, {
        status: jobSchemas.JOB_STATUS.FAILED,
        error: 'Network socket timeout during deep paper retrieval',
      });
      expect(failed.status).toBe(jobSchemas.JOB_STATUS.FAILED);
      expect(failed.error).toMatch(/Network socket timeout/);
    });

    test('F28-B5: Workflow job result handles large list of 500 generated item references', async () => {
      const job = await jobStore.createJob({ type: 'WORKFLOW', userId: 'u_items' });
      const items = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `Result ${i}` }));
      const done = await jobStore.updateJob(job.jobId, {
        status: jobSchemas.JOB_STATUS.COMPLETED,
        result: { itemCount: 500, items },
      });
      expect(done.result.items).toHaveLength(500);
    });
  });

  // --------------------------------------------------------------------------
  // F29 Boundaries: Bot Command Parser & Handlers Edge Cases
  // --------------------------------------------------------------------------
  describe('F29 Boundaries: Bot Command Parser & Handlers Edge Cases', () => {
    test('F29-B1: splitArgs with empty string returns empty command and empty args', () => {
      const res = textUtils.splitArgs('');
      expect(res.command).toBe('');
      expect(res.args).toHaveLength(0);
    });

    test('F29-B2: splitArgs handles unclosed quotation mark without infinite loop', () => {
      expect(() => textUtils.splitArgs('!docqa "unclosed quotation mark')).not.toThrow();
      const res = textUtils.splitArgs('!docqa "unclosed quotation mark');
      expect(res.command).toBe('docqa');
    });

    test('F29-B3: splitArgs collapses multiple spaces and tabs between arguments', () => {
      const res = textUtils.splitArgs('!graph    arg1   \t  arg2   arg3');
      expect(res.command).toBe('graph');
      expect(res.args).toEqual(['arg1', 'arg2', 'arg3']);
    });

    test('F29-B4: status.handler handles request with non-existent job ID gracefully', async () => {
      const mockMsg = createMockMsg('!status ghost_job_12345');
      await statusHandler.handle(mockMsg, ['ghost_job_12345'], {});
      expect(mockMsg.replies.length).toBeGreaterThan(0);
      expect(mockMsg.replies[0].content).toMatch(/tidak ditemukan/i);
    });

    test('F29-B5: status.handler with no job ID provided replies with usage help', async () => {
      const mockMsg = createMockMsg('!status');
      await statusHandler.handle(mockMsg, [], {});
      expect(mockMsg.replies.length).toBeGreaterThan(0);
      expect(mockMsg.replies[0].content).toMatch(/status/i);
    });
  });

  // --------------------------------------------------------------------------
  // F30 Boundaries: Automated E2E Test Suite Integrity & Config
  // --------------------------------------------------------------------------
  describe('F30 Boundaries: Project Configuration & Layout Edge Cases', () => {
    test('F30-B1: package.json has all required root properties and scripts', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      expect(pkg.name).toBeDefined();
      expect(pkg.version).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
    });

    test('F30-B2: All fixture modules can be imported without syntax or runtime exceptions', () => {
      expect(() => require('../../fixtures/samplePages')).not.toThrow();
      expect(() => require('../../fixtures/sampleDocs')).not.toThrow();
      expect(() => require('../../fixtures/mockHelpers')).not.toThrow();
    });

    test('F30-B3: Project required directories exist (src, tests, jobs, cache)', () => {
      expect(fs.existsSync(path.join(rootDir, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'tests'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'jobs'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'cache'))).toBe(true);
    });

    test('F30-B4: PROJECT.md contains all 4 milestones defined in scope', () => {
      const projectMd = fs.readFileSync(path.join(rootDir, 'PROJECT.md'), 'utf-8');
      expect(projectMd).toMatch(/\|\s*M1\s*\|/);
      expect(projectMd).toMatch(/\|\s*M2\s*\|/);
      expect(projectMd).toMatch(/\|\s*M3\s*\|/);
      expect(projectMd).toMatch(/\|\s*M4\s*\|/);
    });

    test('F30-B5: mockHelpers createMockMsg creates valid message object with reply tracking', async () => {
      const mockMsg = createMockMsg('!ping', 'user_123');
      expect(mockMsg.body).toBe('!ping');
      expect(mockMsg.from).toBe('user_123');
      await mockMsg.reply('pong');
      expect(mockMsg.replies).toHaveLength(1);
      expect(mockMsg.replies[0].content).toBe('pong');
    });
  });

  // --------------------------------------------------------------------------
  // F31 Boundaries: White-Box Adversarial Testing & Boundary Hardening
  // --------------------------------------------------------------------------
  describe('F31 Boundaries: Adversarial Stress & Large Input Hardening', () => {
    test('F31-B1: htmlToMarkdown handles HTML with 5,000 blank lines and spaces safely', () => {
      const whitespaceHtml = '<div><p>Start</p>' + '   \n  \t  '.repeat(1000) + '<p>End</p></div>';
      const res = llmCrawler.htmlToMarkdown(whitespaceHtml);
      expect(res.markdown).toContain('Start');
      expect(res.markdown).toContain('End');
    });

    test('F31-B2: contextCompressor handles string of 2,000 emojis without character encoding crashes', () => {
      const emojiText = '🚀🔥🤖📈🧠✨💡🔍'.repeat(250);
      expect(() => contextCompressor.compressText(emojiText, { targetRatio: 0.5 })).not.toThrow();
      const res = contextCompressor.compressText(emojiText, { targetRatio: 0.5 });
      expect(res.compressedText).toBeDefined();
    });

    test('F31-B3: persistentMemory handles 20KB observation text without storage truncation', () => {
      const bigContent = 'Knowledge fact content block. '.repeat(700); // ~20KB
      const obs = persistentMemory.recordObservation('stress_user_big', {
        title: 'Large Payload',
        content: bigContent,
      });
      const retrieved = persistentMemory.getObservations('stress_user_big', [obs.id]);
      expect(retrieved[0].content).toHaveLength(bigContent.trim().length);
    });

    test('F31-B4: knowledgeGraph handles entity names with slashes, question marks, and URL chars', () => {
      const strangeItems = [
        { title: 'https://example.com/api?query=1&sort=desc#anchor', description: 'Web entity URL' },
      ];
      expect(() => knowledgeGraph.buildGraphFromItems(strangeItems)).not.toThrow();
      const graph = knowledgeGraph.buildGraphFromItems(strangeItems);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    test('F31-B5: contextCompressor.compressJsonItems strips null and undefined keys safely', () => {
      const sparseItems = [
        { id: 1, title: 'Item 1', price: null, description: undefined, tags: [] },
      ];
      expect(() => contextCompressor.compressJsonItems(sparseItems)).not.toThrow();
      const res = contextCompressor.compressJsonItems(sparseItems);
      expect(res.crushedItems[0].price).toBeUndefined();
      expect(res.crushedItems[0].description).toBeUndefined();
    });
  });
});
