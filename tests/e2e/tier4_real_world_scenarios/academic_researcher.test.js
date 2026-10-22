'use strict';

/**
 * @fileoverview Tier 4 Real-World Application Scenario: Academic Researcher Workflow.
 * Simulates an end-to-end user journey of an AI researcher analyzing scientific papers,
 * extracting tabular metrics, generating a concept knowledge graph, indexing into local RAG,
 * performing grounded Q&A, and persisting takeaways in episodic memory.
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 4: Real-World Scenario — Academic Researcher Workflow', () => {
  const rootDir = process.cwd();

  let pdfLoader;
  let ragEngine;
  let knowledgeGraph;
  let persistentMemory;
  let contextCompressor;

  beforeAll(() => {
    pdfLoader = require(path.join(rootDir, 'src', 'services', 'pdf', 'pdfLoader'));
    ragEngine = require(path.join(rootDir, 'src', 'services', 'rag', 'ragEngine'));
    knowledgeGraph = require(path.join(rootDir, 'src', 'services', 'graph', 'knowledgeGraph'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
  });

  beforeEach(() => {
    if (ragEngine && typeof ragEngine.clearIndex === 'function') {
      ragEngine.clearIndex();
    }
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  test('End-to-End Researcher Workflow: Ingest -> Index -> Q&A -> Graphify -> Memory Record', async () => {
    const researcherId = 'prof_kaiming_he';

    // Step 1: Researcher ingests paper text and inspects layout structure
    const layout = pdfLoader.extractLayoutStructure(sampleDocs.academicPaperText);
    expect(layout.title).toBe('Deep Residual Learning for Image Recognition');
    expect(layout.sections.length).toBeGreaterThanOrEqual(3);
    expect(layout.wordCount).toBeGreaterThan(100);

    // Step 2: Index paper into hybrid RAG engine
    const indexStats = ragEngine.indexDocument('resnet_2015', sampleDocs.academicPaperText, {
      title: layout.title,
    });
    expect(indexStats.chunkCount).toBeGreaterThanOrEqual(5);

    // Step 3: Researcher queries specific findings (vanishing gradients)
    const hits = ragEngine.retrieve('degradation problem vanishing gradients residual learning');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content).toMatch(/degradation|gradient|residual/i);
    expect(hits[0].citation).toBe('[1]');

    // Step 4: Perform grounded Q&A synthesis
    const qaResult = await ragEngine.answerWithRag('What is the degradation problem in deep networks?');
    expect(qaResult.citations.length).toBeGreaterThan(0);
    expect(qaResult.answer).toBeDefined();

    // Step 5: Synthesize Knowledge Graph of paper entities & methodologies
    const graph = knowledgeGraph.buildGraphFromText(sampleDocs.academicPaperText, {
      title: layout.title,
    });
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Step 6: Export Mermaid diagram for WhatsApp delivery
    const mermaid = knowledgeGraph.toMermaid(graph, 8);
    expect(mermaid.startsWith('flowchart LR')).toBe(true);
    expect(mermaid).toMatch(/-->/);

    // Step 7: Export Markdown report with God Nodes
    const report = knowledgeGraph.toMarkdownReport(graph);
    expect(report).toMatch(/GRAPHIFY KNOWLEDGE GRAPH REPORT/);
    expect(report).toMatch(/God Nodes/i);

    // Step 8: Researcher records takeaway observation into persistent memory
    const obs = persistentMemory.recordObservation(researcherId, {
      type: 'paper_analysis',
      title: 'ResNet Architectural Takeaways',
      content: 'Identity shortcut connections solve vanishing gradients without extra parameters. Top-5 error: 3.57% on ImageNet.',
      tags: ['resnet', 'identity_mapping', 'imagenet', 'vision'],
      meta: { paperId: 'resnet_2015', topCitations: qaResult.citations.map(c => c.citation) },
    });
    expect(obs.id).toBeDefined();

    // Step 9: Rehydrate researcher context in new interaction
    const memoryPrompt = persistentMemory.buildMemoryContextPrompt(researcherId, 'identity shortcut');
    expect(memoryPrompt).toContain('ResNet Architectural Takeaways');
    expect(memoryPrompt).toContain('vanishing gradients');

    // Step 10: Optimize token headroom for final response
    const compressedReport = contextCompressor.compressText(report, { targetRatio: 0.5 });
    expect(compressedReport.stats.compressedTokens).toBeDefined();
    expect(compressedReport.compressedText).toContain('mermaid');
  });
});
