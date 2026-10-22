'use strict';

/**
 * @fileoverview Tier 4 Real-World Application Scenario: Domain Knowledge Explorer Workflow.
 * Simulates an end-to-end user journey of a domain specialist constructing an enterprise knowledge base
 * from multi-source crawls, discovering God-Node hubs and topic communities, generating Mermaid
 * flowcharts for WhatsApp dispatch, and recording structural takeaways in persistent memory.
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');
const samplePages = require('../../fixtures/samplePages');

describe('Tier 4: Real-World Scenario — Domain Knowledge Explorer Workflow', () => {
  const rootDir = process.cwd();

  let llmCrawler;
  let knowledgeGraph;
  let contextCompressor;
  let persistentMemory;

  beforeAll(() => {
    llmCrawler = require(path.join(rootDir, 'src', 'engine', 'llmCrawler'));
    knowledgeGraph = require(path.join(rootDir, 'src', 'services', 'graph', 'knowledgeGraph'));
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
  });

  beforeEach(() => {
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  test('End-to-End Domain Explorer: Multi-Source Crawl -> Entity Extraction -> God Nodes -> Mermaid -> Memory', () => {
    const explorerId = 'domain_architect_01';

    // Step 1: Explorer crawls tech blog and extracts clean Fit-Markdown
    const blogCrawl = llmCrawler.htmlToMarkdown(samplePages.blogPage);
    expect(blogCrawl.fitMarkdown).toBeDefined();
    expect(blogCrawl.fitMarkdown).toContain('Transformer');

    // Step 2: Combine web crawl with specialized scientific corpus
    const unifiedCorpus = [
      `# Domain Source 1: Web Overview\n${blogCrawl.fitMarkdown}`,
      `# Domain Source 2: Scientific Breakthroughs\n${sampleDocs.graphCorpusText}`,
    ].join('\n\n---\n\n');

    expect(unifiedCorpus).toContain('AlphaFold');
    expect(unifiedCorpus).toContain('DeepMind');

    // Step 3: Extract entity graph from multi-source corpus
    const graph = knowledgeGraph.buildGraphFromText(unifiedCorpus, {
      title: 'Artificial Intelligence & Computational Biology',
    });
    expect(graph.nodes.length).toBeGreaterThanOrEqual(5);
    expect(graph.edges.length).toBeGreaterThanOrEqual(3);

    // Step 4: God-Node Centrality Analysis (rank key structural hubs)
    expect(graph.godNodes).toBeDefined();
    expect(graph.godNodes.length).toBeGreaterThan(0);
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    expect(nodeIds.has('alphafold') || nodeIds.has('transformer') || nodeIds.has('deepmind')).toBe(true);

    // Step 5: Community Topic Clustering
    expect(graph.communities).toBeDefined();
    expect(Array.isArray(graph.communities)).toBe(true);

    // Step 6: Render Mermaid diagram for WhatsApp interface
    const mermaid = knowledgeGraph.toMermaid(graph, 12);
    expect(mermaid.startsWith('flowchart LR')).toBe(true);
    expect(mermaid).toMatch(/-->\|[A-Z_]+\|/);

    // Step 7: Export comprehensive GRAPH_REPORT.md
    const report = knowledgeGraph.toMarkdownReport(graph);
    expect(report).toMatch(/GRAPHIFY KNOWLEDGE GRAPH REPORT/);
    expect(report).toMatch(/God Nodes/i);
    expect(report).toMatch(/Topic Communities/i);

    // Step 8: Compress report for WhatsApp mobile screen headroom (< 800 tokens)
    const compressed = contextCompressor.compressText(report, { targetRatio: 0.6 });
    expect(compressed.stats.compressedTokens).toBeDefined();
    expect(compressed.compressedText.length).toBeGreaterThan(50);

    // Step 9: Explorer persists domain knowledge milestone
    const obs = persistentMemory.recordObservation(explorerId, {
      type: 'domain_synthesis',
      title: 'AI Biology Domain Synthesis: AlphaFold',
      content: `Primary breakthrough: AlphaFold. Discovered ${graph.communities.length} communities and ${graph.godNodes.length} god nodes.`,
      tags: ['knowledge_graph', 'god_nodes', 'alphafold', 'transformer'],
    });
    expect(obs.id).toBeDefined();

    // Step 10: Rehydrate domain structure in future session
    const restoredPrompt = persistentMemory.buildMemoryContextPrompt(explorerId, 'god nodes alphafold');
    expect(restoredPrompt).toContain('AI Biology Domain Synthesis');
    expect(restoredPrompt).toContain('AlphaFold');
  });
});
