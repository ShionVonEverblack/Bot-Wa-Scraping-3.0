'use strict';

/**
 * @fileoverview Tier 3 Cross-Feature Combination: Document to Persistent Memory & RAG Pipeline.
 * Tests end-to-end integration between:
 *   - F17 (Layout-Aware Document Parser)
 *   - F18 (Table Structure Reconstructor)
 *   - F19 (Contextual Document Chunker)
 *   - F20 (Zero-Dependency Hybrid RAG)
 *   - F21 (Document Grounded Q&A Pipeline)
 *   - F25 (Layered Persistent Memory)
 *   - F27 (Cross-Session Persistence)
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 3: Cross-Feature Combination — Document to Memory & RAG Pipeline', () => {
  const rootDir = process.cwd();

  let pdfLoader;
  let ragEngine;
  let persistentMemory;

  beforeAll(() => {
    pdfLoader = require(path.join(rootDir, 'src', 'services', 'pdf', 'pdfLoader'));
    ragEngine = require(path.join(rootDir, 'src', 'services', 'rag', 'ragEngine'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
  });

  beforeEach(() => {
    if (ragEngine && typeof ragEngine.clearIndex === 'function') {
      ragEngine.clearIndex();
    }
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Document Ingest -> Layout Analysis -> Chunking -> Hybrid RAG
  // --------------------------------------------------------------------------
  test('P2-1: End-to-end pipeline from raw document text to breadcrumb chunks and hybrid retrieval', () => {
    // 1. Analyze document layout
    const layout = pdfLoader.extractLayoutStructure(sampleDocs.academicPaperText);
    expect(layout.title).toMatch(/Deep Residual Learning/i);
    expect(layout.sections.length).toBeGreaterThanOrEqual(3);

    // 2. Chunk document with breadcrumb annotations
    const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText, {
      title: layout.title,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content).toMatch(/\[Deep Residual Learning/);
      expect(chunk.tokens.length).toBeGreaterThan(0);
    }

    // 3. Index into RAG Engine
    const indexStats = ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
      title: layout.title,
    });
    expect(indexStats.chunkCount).toBe(chunks.length);

    // 4. Retrieve with Hybrid BM25 + Cosine scoring
    const hits = ragEngine.retrieve('vanishing gradient residual connections');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].rrfScore).toBeGreaterThan(0);
    expect(hits[0].content).toMatch(/gradient|residual|degradation/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Grounded Q&A -> Observation Recording in Persistent Memory
  // --------------------------------------------------------------------------
  test('P2-2: Q&A answer generation automatically links to episodic persistent memory', async () => {
    const userId = 'researcher_deep_01';

    // 1. Index document
    ragEngine.indexDocument('resnet_doc', sampleDocs.academicPaperText);

    // 2. Answer question using RAG pipeline
    const question = 'What is the error rate of ResNet-152 on ImageNet?';
    const qaResult = await ragEngine.answerWithRag(question);
    expect(qaResult.citations.length).toBeGreaterThan(0);
    expect(qaResult.answer).toBeDefined();
    expect(qaResult.answer.length).toBeGreaterThan(10);

    // 3. Record Q&A interaction into user persistent memory
    const obs = persistentMemory.recordObservation(userId, {
      type: 'qa_turn',
      title: `Q&A: ${question.slice(0, 40)}`,
      content: `Question: ${question}\nCitations: ${qaResult.citations.map(c => c.citation).join(', ')}`,
      meta: { docId: 'resnet_doc', topCitation: qaResult.citations[0].citation },
    });

    expect(obs.id).toBeDefined();
    expect(obs.userId).toBe(userId);

    // 4. Verify observation is discoverable via Layer 1 memory search
    const memoryHits = persistentMemory.searchIndex(userId, 'ImageNet error rate');
    expect(memoryHits.length).toBeGreaterThan(0);
    expect(memoryHits[0].id).toBe(obs.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Multi-Turn Conversation Memory Context Feeding RAG Prompts
  // --------------------------------------------------------------------------
  test('P2-3: Multi-turn user history preserved in memory injects context into successive queries', () => {
    const userId = 'multi_turn_user';

    // Turn 1: User prefers PyTorch
    persistentMemory.recordObservation(userId, {
      type: 'preference',
      title: 'Framework Preference',
      content: 'User prefers PyTorch 2.0 implementations for computer vision.',
    });

    // Turn 2: User investigated ResNet earlier
    persistentMemory.recordObservation(userId, {
      type: 'history',
      title: 'Previous Exploration',
      content: 'Studied ResNet residual blocks and shortcut connections.',
    });

    // Generate memory context block
    const memoryPrompt = persistentMemory.buildMemoryContextPrompt(userId, 'PyTorch vision');
    expect(memoryPrompt).toContain('User Persistent Memory');
    expect(memoryPrompt).toContain('Framework Preference');
    expect(memoryPrompt).toContain('PyTorch 2.0');

    // Verify it cleanly combines with RAG prompt
    const finalPrompt = `${memoryPrompt}\n\n${ragEngine.buildGroundedPrompt('How to implement shortcut?', [])}`;
    expect(finalPrompt).toContain('PyTorch 2.0');
    expect(finalPrompt).toContain('How to implement shortcut?');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Table Data Extraction through RAG Retrieval
  // --------------------------------------------------------------------------
  test('P2-4: PDF/Doc tabular data parsed into Markdown table is retrievable via numeric queries', () => {
    const rawTableLines = [
      'Architecture\tLayers\tTop-5 Error',
      'VGG-19\t19\t7.3%',
      'ResNet-152\t152\t3.57%',
    ];
    const mdTable = pdfLoader.convertLinesToMarkdownTable(rawTableLines);
    expect(mdTable).toMatch(/\| Architecture \| Layers \| Top-5 Error \|/);

    const docWithTable = `Title: ImageNet Benchmarks\n\n1. Results Summary\n\n${mdTable}\n\nEnd of report.`;
    ragEngine.indexDocument('table_doc', docWithTable);

    const hits = ragEngine.retrieve('3.57% top-5 error ResNet-152');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content).toContain('3.57%');
    expect(hits[0].content).toContain('ResNet-152');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Document Partitioning & Isolation in RAG Engine
  // --------------------------------------------------------------------------
  test('P2-5: Multiple concurrent documents maintain strict partition during retrieval', () => {
    ragEngine.indexDocument('doc_alpha', 'Supervised learning with Convolutional Neural Networks for vision.');
    ragEngine.indexDocument('doc_beta', 'Unsupervised learning with Generative Adversarial Networks for synthesis.');

    // Query doc_alpha specifically
    const hitsAlpha = ragEngine.retrieve('Convolutional Neural Networks', { docId: 'doc_alpha' });
    expect(hitsAlpha.every(h => h.docId === 'doc_alpha')).toBe(true);

    // Query doc_beta specifically
    const hitsBeta = ragEngine.retrieve('Generative Adversarial Networks', { docId: 'doc_beta' });
    expect(hitsBeta.every(h => h.docId === 'doc_beta')).toBe(true);

    // Cross-query with non-existent docId yields 0 hits
    const ghostHits = ragEngine.retrieve('Convolutional Neural Networks', { docId: 'non_existent_doc' });
    expect(ghostHits).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Decoupled Lifecycle: Clearing Memory Does Not Corrupt RAG Index
  // --------------------------------------------------------------------------
  test('P2-6: Clearing user memory leaves RAG index untouched and vice-versa', () => {
    const user = 'decoupled_user';
    persistentMemory.recordObservation(user, { title: 'Test Obs' });
    ragEngine.indexDocument('doc_persist', sampleDocs.academicPaperText);

    // Clear memory
    persistentMemory.clearMemory(user);
    expect(persistentMemory.searchIndex(user, '')).toHaveLength(0);

    // RAG index is still healthy and retrievable
    expect(ragEngine.getStats().totalDocuments).toBe(1);
    const hits = ragEngine.retrieve('residual');
    expect(hits.length).toBeGreaterThan(0);

    // Clear RAG index
    ragEngine.clearIndex();
    expect(ragEngine.getStats().totalDocuments).toBe(0);
  });
});
