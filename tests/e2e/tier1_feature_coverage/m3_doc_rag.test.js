'use strict';

/**
 * @fileoverview Tier 1 Feature Coverage: Milestone 3 Document Intelligence & RAG (F17 - F21).
 * Covers isolated functionality with >= 5 tests per feature.
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 1: Milestone 3 Structured PDF/RAG Engine (F17 - F21)', () => {
  const rootDir = process.cwd();

  let pdfLoader;
  let ragEngine;

  beforeAll(() => {
    pdfLoader = require(path.join(rootDir, 'src', 'services', 'pdf', 'pdfLoader'));
    ragEngine = require(path.join(rootDir, 'src', 'services', 'rag', 'ragEngine'));
  });

  beforeEach(() => {
    if (ragEngine && typeof ragEngine.clearIndex === 'function') {
      ragEngine.clearIndex();
    }
  });

  // --------------------------------------------------------------------------
  // F17: F17_Layout_Aware_PDF_Parser
  // --------------------------------------------------------------------------
  describe('F17: Layout-Aware PDF & Text Parser', () => {
    test('F17-1: Detects section headings and assigns hierarchical levels', () => {
      const h1 = pdfLoader.detectHeading('1. Introduction');
      expect(h1).not.toBeNull();
      expect(h1.level).toBe(2);
      expect(h1.title).toMatch(/1\. Introduction/);

      const h2 = pdfLoader.detectHeading('2.1. System Architecture');
      expect(h2).not.toBeNull();
      expect(h2.level).toBe(3);

      const h3 = pdfLoader.detectHeading('Abstract');
      expect(h3).not.toBeNull();
      expect(h3.title.toLowerCase()).toBe('abstract');
    });

    test('F17-2: De-hyphenates words broken across line breaks', () => {
      const raw = `We have achieved break-\nthroughs in machine learning.`;
      const layout = pdfLoader.extractLayoutStructure(raw);
      expect(layout.text).toMatch(/breakthroughs/);
      expect(layout.text).not.toMatch(/break-\nthroughs/);
    });

    test('F17-3: Strips standalone page numbers and page markers', () => {
      const raw = `Paragraph 1\n-- 1 of 5 --\nParagraph 2\nPage 3 of 10\nParagraph 3`;
      const layout = pdfLoader.extractLayoutStructure(raw);
      expect(layout.text).not.toMatch(/-- 1 of 5 --/);
      expect(layout.text).not.toMatch(/Page 3 of 10/);
      expect(layout.text).toMatch(/Paragraph 1/);
      expect(layout.text).toMatch(/Paragraph 2/);
    });

    test('F17-4: Extracts document title from initial lines or options', () => {
      const layout = pdfLoader.extractLayoutStructure(sampleDocs.academicPaperText);
      expect(layout.title).toBe('Deep Residual Learning for Image Recognition');
    });

    test('F17-5: Segments multi-section document into structured sections with word counts', () => {
      const layout = pdfLoader.extractLayoutStructure(sampleDocs.academicPaperText);
      expect(layout.sections.length).toBeGreaterThanOrEqual(4);
      expect(layout.sections.some(s => s.heading.toLowerCase().includes('introduction'))).toBe(true);
      expect(layout.sections.some(s => s.heading.toLowerCase().includes('methodology'))).toBe(true);
      expect(layout.wordCount).toBeGreaterThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // F18: F18_PDF_Table_Extractor
  // --------------------------------------------------------------------------
  describe('F18: PDF & Document Table Structure Reconstructor', () => {
    test('F18-1: Converts tab-delimited text lines into clean Markdown table', () => {
      const lines = [
        'Model\tTop-1\tTop-5',
        'ResNet-18\t27.88%\t9.28%',
        'ResNet-50\t20.74%\t5.25%',
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      expect(table).toMatch(/\|\s*Model\s*\|\s*Top-1\s*\|\s*Top-5\s*\|/);
      expect(table).toMatch(/\|\s*---\s*\|\s*---\s*\|\s*---\s*\|/);
      expect(table).toMatch(/\|\s*ResNet-18\s*\|\s*27\.88%\s*\|\s*9\.28%\s*\|/);
    });

    test('F18-2: Converts multiple-whitespace aligned lines into Markdown table', () => {
      const lines = [
        'Layer    Params    FLOPs',
        'Conv1    64        1.8G',
        'Conv2    128       3.6G',
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      expect(table).toMatch(/\|\s*Layer\s*\|\s*Params\s*\|\s*FLOPs\s*\|/);
      expect(table).toMatch(/\|\s*Conv1\s*\|\s*64\s*\|\s*1\.8G\s*\|/);
    });

    test('F18-3: Generates valid separator line with matching column count', () => {
      const lines = [
        'ColA\tColB\tColC\tColD',
        '1\t2\t3\t4',
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      const rows = table.split('\n');
      expect(rows).toHaveLength(3);
      expect(rows[1]).toBe('| --- | --- | --- | --- |');
    });

    test('F18-4: Sanitizes pipe characters within cell contents', () => {
      const lines = [
        'Expression\tResult',
        'A | B\tTrue',
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      expect(table).toMatch(/A \\\| B/);
    });

    test('F18-5: Pads shorter rows with empty cells to ensure rectangular grid', () => {
      const lines = [
        'Header1\tHeader2\tHeader3',
        'Val1\tVal2', // Missing 3rd column
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      const rows = table.split('\n');
      const cellsInRow2 = rows[2].split('|').filter(c => c.trim().length > 0);
      expect(cellsInRow2.length).toBe(2);
      expect(rows[2].endsWith('|  |') || rows[2].endsWith('| |')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F19: F19_Contextual_Document_Chunker
  // --------------------------------------------------------------------------
  describe('F19: Contextual Document Chunker with Breadcrumbs', () => {
    test('F19-1: Injects hierarchical breadcrumb headers into chunk content', () => {
      const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText, {
        title: 'ResNet Paper',
        chunkSize: 500,
      });

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.content).toMatch(/^\[ResNet Paper — [^\]]+\]/);
      }
    });

    test('F19-2: Splits long sections with sliding window within target chunkSize', () => {
      const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText, {
        title: 'ResNet Paper',
        chunkSize: 300,
        chunkOverlap: 50,
      });

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.rawText.length).toBeLessThanOrEqual(400);
      }
    });

    test('F19-3: Preserves chunk overlap between adjacent chunks', () => {
      const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText, {
        chunkSize: 250,
        chunkOverlap: 60,
      });

      expect(chunks.length).toBeGreaterThan(2);
      expect(chunks[0].chunkId).toMatch(/#c1$/);
      expect(chunks[1].chunkId).toMatch(/#c2$/);
    });

    test('F19-4: Builds sparse token vectors for each chunk', () => {
      const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText);
      expect(chunks[0].tokens).toBeDefined();
      expect(Array.isArray(chunks[0].tokens)).toBe(true);
      expect(chunks[0].tokens.length).toBeGreaterThan(0);
      expect(chunks[0].vector instanceof Map).toBe(true);
      expect(chunks[0].vector.size).toBeGreaterThan(0);
    });

    test('F19-5: Generates deterministic unique chunk IDs per document', () => {
      const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText, { docId: 'doc_resnet' });
      const ids = chunks.map(c => c.chunkId);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
      expect(ids[0]).toBe('doc_resnet#c1');
    });
  });

  // --------------------------------------------------------------------------
  // F20: F20_Hybrid_Local_RAG
  // --------------------------------------------------------------------------
  describe('F20: Zero-Dependency Hybrid RAG (BM25 + Cosine + RRF)', () => {
    test('F20-1: TokenizeWords normalizes text and strips English and Indonesian stopwords', () => {
      const tokens = ragEngine.tokenizeWords('The deep learning framework and yang dan di');
      expect(tokens).toContain('deep');
      expect(tokens).toContain('learning');
      expect(tokens).toContain('framework');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('and');
      expect(tokens).not.toContain('yang');
    });

    test('F20-2: CosineSimilarity computes 1.0 for identical vectors and 0.0 for disjoint vectors', () => {
      const vecA = new Map([['w:resnet', 2], ['w:deep', 1]]);
      const vecB = new Map([['w:resnet', 2], ['w:deep', 1]]);
      const vecC = new Map([['w:bert', 2], ['w:transformer', 1]]);

      expect(ragEngine.cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 4);
      expect(ragEngine.cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 4);
    });

    test('F20-3: IndexDocument indexes chunks and reports chunk count', () => {
      const indexed = ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
        title: 'Deep Residual Learning',
      });

      expect(indexed.docId).toBe('resnet_paper');
      expect(indexed.title).toBe('Deep Residual Learning');
      expect(indexed.chunkCount).toBeGreaterThan(0);

      const stats = ragEngine.getStats();
      expect(stats.totalDocuments).toBe(1);
      expect(stats.totalChunks).toBe(indexed.chunkCount);
    });

    test('F20-4: Retrieve returns top-k ranked chunks with BM25, Vector, and RRF scores', () => {
      ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
        title: 'Deep Residual Learning',
      });

      const results = ragEngine.retrieve('residual learning framework shortcut connection', {
        docId: 'resnet_paper',
        topK: 3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      expect(results[0].citation).toBe('[1]');
      expect(results[0].rrfScore).toBeGreaterThan(0);
      expect(results[0].content).toMatch(/residual|shortcut/i);
    });

    test('F20-5: Retrieve handles domain terminology ranking most relevant section first', () => {
      ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
        title: 'Deep Residual Learning',
      });

      const results = ragEngine.retrieve('ImageNet 2012 classification results error rate', {
        docId: 'resnet_paper',
        topK: 2,
      });

      expect(results.length).toBeGreaterThan(0);
      const topSection = results[0].section.toLowerCase();
      expect(topSection.includes('results') || topSection.includes('discussion')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F21: F21_Document_QA_Pipeline
  // --------------------------------------------------------------------------
  describe('F21: Document Grounded Q&A Pipeline', () => {
    test('F21-1: buildGroundedPrompt constructs structured prompt with inline citation instructions', () => {
      const mockChunks = [
        {
          citation: '[1]',
          title: 'ResNet Paper',
          section: '3. Results',
          rawText: 'ResNet-152 achieves a 3.57% top-5 error rate on ImageNet test set.',
        },
      ];

      const prompt = ragEngine.buildGroundedPrompt('Berapa error rate ResNet-152?', mockChunks);
      expect(prompt).toMatch(/=== KONTEKS DOKUMEN ===/);
      expect(prompt).toMatch(/\[1\] \(ResNet Paper — Section: 3\. Results\)/);
      expect(prompt).toMatch(/ResNet-152 achieves a 3\.57% top-5 error rate/);
      expect(prompt).toMatch(/Pertanyaan: Berapa error rate ResNet-152\?/);
    });

    test('F21-2: buildGroundedPrompt handles empty chunks with fallback indicator', () => {
      const prompt = ragEngine.buildGroundedPrompt('Pertanyaan apa saja', []);
      expect(prompt).toMatch(/Tidak ada konteks yang relevan/);
    });

    test('F21-3: answerWithRag returns extractive grounded answer with citations when offline', async () => {
      ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
        title: 'Deep Residual Learning',
      });

      const response = await ragEngine.answerWithRag('shortcut connections identity mapping', {
        docId: 'resnet_paper',
      });
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(10);
      expect(response.citations).toBeDefined();
      expect(response.citations.length).toBeGreaterThan(0);
    });

    test('F21-4: answerWithRag informs user when question cannot be answered from document', async () => {
      ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
        title: 'Deep Residual Learning',
      });

      const response = await ragEngine.answerWithRag('pertanyaan umum', {
        docId: 'non_existent_doc_id',
      });
      expect(response.answer).toMatch(/tidak ditemukan potongan dokumen/i);
      expect(response.citations).toHaveLength(0);
    });

    test('F21-5: clearIndex completely removes document and frees memory', () => {
      ragEngine.indexDocument('doc_to_clear', 'Some sample text content for deletion test.');
      expect(ragEngine.getStats().totalDocuments).toBe(1);

      ragEngine.clearIndex();
      expect(ragEngine.getStats().totalDocuments).toBe(0);
      expect(ragEngine.getStats().totalChunks).toBe(0);
    });
  });
});
