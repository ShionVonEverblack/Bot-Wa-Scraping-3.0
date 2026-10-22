'use strict';

/**
 * @fileoverview Tier 3 Cross-Feature Combination: Web Crawling to Knowledge Graph Pipeline.
 * Tests end-to-end integration between:
 *   - F09 (Boilerplate Stripping)
 *   - F10 (Fit-Markdown Converter)
 *   - F11 (Structured Content Extraction)
 *   - F22 (Knowledge Graph Extraction)
 *   - F23 (Centrality & Community Clustering)
 *   - F24 (Mermaid Visualizer)
 */

const path = require('path');
const samplePages = require('../../fixtures/samplePages');

describe('Tier 3: Cross-Feature Combination — Crawl to Knowledge Graph Pipeline', () => {
  const rootDir = process.cwd();

  let llmCrawler;
  let knowledgeGraph;
  let contextCompressor;

  beforeAll(() => {
    llmCrawler = require(path.join(rootDir, 'src', 'engine', 'llmCrawler'));
    knowledgeGraph = require(path.join(rootDir, 'src', 'services', 'graph', 'knowledgeGraph'));
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Raw HTML -> Fit-Markdown -> Knowledge Graph -> Mermaid Diagram
  // --------------------------------------------------------------------------
  test('P1-1: Full pipeline: Raw noisy blog HTML to clean Knowledge Graph and Mermaid flowchart', () => {
    // 1. Convert raw HTML to Fit-Markdown (strips nav, header, ads, footer)
    const crawlResult = llmCrawler.htmlToMarkdown(samplePages.blogPage);
    expect(crawlResult.markdown).toBeDefined();
    expect(crawlResult.fitMarkdown).toBeDefined();
    expect(crawlResult.fitMarkdown).not.toMatch(/Cookie Policy/i);
    expect(crawlResult.fitMarkdown).not.toMatch(/Sponsored Links/i);
    expect(crawlResult.fitMarkdown).toMatch(/Transformer/);

    // 2. Build Knowledge Graph from the extracted Fit-Markdown
    const graph = knowledgeGraph.buildGraphFromText(crawlResult.fitMarkdown, {
      title: crawlResult.title || 'Transformer Architecture',
    });
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // 3. Verify key technological entities are identified as nodes
    const nodeLabels = graph.nodes.map(n => n.label.toLowerCase());
    expect(nodeLabels.some(l => l.includes('transformer') || l.includes('attention') || l.includes('neural'))).toBe(true);

    // 4. Generate Mermaid visualizer syntax
    const mermaid = knowledgeGraph.toMermaid(graph, 10);
    expect(mermaid.startsWith('flowchart LR')).toBe(true);
    expect(mermaid).toMatch(/-->/);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: E-Commerce Catalog -> Structured Extraction -> Item Graph
  // --------------------------------------------------------------------------
  test('P1-2: E-commerce catalog extraction feeding into relational item graph and Markdown report', () => {
    // 1. Extract markdown and metadata from e-commerce page
    const crawlResult = llmCrawler.htmlToMarkdown(samplePages.ecommercePage);
    expect(crawlResult.markdown).toMatch(/UltraBook Pro Max/);

    // 2. Extract item entities from links or text
    const items = [
      { title: 'UltraBook Pro Max', description: 'Laptop with 16-Core Neural Engine and Unified Memory' },
      { title: 'Neural Engine', description: 'High efficiency hardware accelerator' },
    ];

    // 3. Build graph from catalog items
    const graph = knowledgeGraph.buildGraphFromItems(items, { topic: 'Computer Hardware' });
    expect(graph.nodes.length).toBeGreaterThanOrEqual(items.length);

    // 4. Generate comprehensive Markdown report
    const report = knowledgeGraph.toMarkdownReport(graph);
    expect(report).toMatch(/GRAPHIFY KNOWLEDGE GRAPH REPORT/);
    expect(report).toMatch(/Nodes:/);
    expect(report).toMatch(/Edges:/);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Malformed Web Page -> Noise Pruning -> Graceful Graph Fallback
  // --------------------------------------------------------------------------
  test('P1-3: Adversarial malformed HTML with unclosed tags produces stable graph without script leakage', () => {
    // 1. Process malformed HTML
    const crawlResult = llmCrawler.htmlToMarkdown(samplePages.malformedPage);
    expect(crawlResult.markdown).toMatch(/nested divs/);
    expect(crawlResult.markdown).not.toContain('<script>');
    expect(crawlResult.markdown).not.toContain('alert(');

    // 2. Build graph from cleaned text
    const graph = knowledgeGraph.buildGraphFromText(crawlResult.markdown);
    expect(graph.nodes.every(n => !n.label.includes('<script>') && !n.label.includes('alert('))).toBe(true);

    // 3. Mermaid output is safe and valid
    const mermaid = knowledgeGraph.toMermaid(graph);
    expect(mermaid.startsWith('flowchart LR')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Table Data -> Markdown Table -> Entity Linking
  // --------------------------------------------------------------------------
  test('P1-4: HTML tables preserved in Markdown and parsed for structured entity relations', () => {
    const crawlResult = llmCrawler.htmlToMarkdown(samplePages.tablePage);
    expect(crawlResult.markdown).toMatch(/\| Architecture \| GPU Model \|/);
    expect(crawlResult.markdown).toMatch(/H100 SXM5/);

    const graph = knowledgeGraph.buildGraphFromText(crawlResult.markdown);
    expect(graph.nodes.length).toBeGreaterThan(0);
    const labels = graph.nodes.map(n => n.label.toLowerCase());
    expect(labels.some(l => l.includes('hopper') || l.includes('blackwell') || l.includes('lovelace') || l.includes('gpu'))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Multi-Stage Token Optimization: HTML -> Fit-Markdown -> Graph Report
  // --------------------------------------------------------------------------
  test('P1-5: Progressive token reduction across crawl-to-graph pipeline', () => {
    const rawTokens = contextCompressor.estimateTokens(samplePages.blogPage);

    // Stage 1: Fit-Markdown conversion
    const crawlResult = llmCrawler.htmlToMarkdown(samplePages.blogPage);
    const mdTokens = contextCompressor.estimateTokens(crawlResult.fitMarkdown || crawlResult.markdown);
    expect(mdTokens).toBeLessThan(rawTokens);

    // Stage 2: Knowledge Graph synthesis
    const graph = knowledgeGraph.buildGraphFromText(crawlResult.fitMarkdown || crawlResult.markdown);
    const report = knowledgeGraph.toMarkdownReport(graph);
    const reportTokens = contextCompressor.estimateTokens(report);

    // Report should be dense and structured
    expect(reportTokens).toBeGreaterThan(0);
    expect(report).toMatch(/God Nodes/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Empty Crawled Content Edge Case through Entire Graph Pipeline
  // --------------------------------------------------------------------------
  test('P1-6: Empty crawled content propagates gracefully through graph without throwing', () => {
    const emptyCrawl = llmCrawler.htmlToMarkdown('<html><body></body></html>');
    expect(emptyCrawl.markdown).toBe('');

    const graph = knowledgeGraph.buildGraphFromText(emptyCrawl.markdown);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);

    const report = knowledgeGraph.toMarkdownReport(graph);
    expect(report).toMatch(/Knowledge Graph kosong/i);

    const mermaid = knowledgeGraph.toMermaid(graph);
    expect(mermaid).toMatch(/No Graph Data/);
  });
});
