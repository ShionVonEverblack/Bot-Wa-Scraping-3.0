'use strict';

/**
 * @fileoverview Tier 2 Boundary & Corner Cases: Document Intelligence & RAG Subsystem (F17 - F21).
 * Tests extreme boundaries, empty buffers, scanned documents, long texts, and zero-match RAG queries.
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 2: Boundary & Corner Cases — Document Intelligence & RAG (F17 - F21)', () => {
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
  // F17 Boundaries: Layout-Aware PDF Parser
  // --------------------------------------------------------------------------
  describe('F17 Boundaries: PDF & Layout Text Parsing Edge Cases', () => {
    test('F17-B1: parseBuffer throws error when passed empty Buffer', async () => {
      await expect(pdfLoader.parseBuffer(Buffer.alloc(0))).rejects.toThrow(/Empty PDF buffer/i);
    });

    test('F17-B2: extractLayoutStructure handles null, undefined, or non-string inputs cleanly', () => {
      const resNull = pdfLoader.extractLayoutStructure(null);
      expect(resNull.title).toBe('Untitled Document');
      expect(resNull.sections).toHaveLength(0);
      expect(resNull.wordCount).toBe(0);

      const resUndef = pdfLoader.extractLayoutStructure(undefined);
      expect(resUndef.sections).toHaveLength(0);
    });

    test('F17-B3: detectHeading returns null for strings exceeding 100 characters', () => {
      const longHeading = '1. ' + 'Introduction to Advanced Machine Learning and Neural Networks '.repeat(3);
      expect(longHeading.length).toBeGreaterThan(100);
      expect(pdfLoader.detectHeading(longHeading)).toBeNull();
    });

    test('F17-B4: Handles document with 50 sequential numbered headings', () => {
      let docText = 'Title of Large Document\n\n';
      for (let i = 1; i <= 50; i++) {
        docText += `${i}. Section Heading ${i}\nContent for section ${i}.\n\n`;
      }
      const layout = pdfLoader.extractLayoutStructure(docText);
      expect(layout.sections.length).toBeGreaterThanOrEqual(40);
    });

    test('F17-B5: Handles single giant unpunctuated block of 20,000 characters without crashing', () => {
      const giantText = 'DeepLearning '.repeat(1500);
      const layout = pdfLoader.extractLayoutStructure(giantText);
      expect(layout.wordCount).toBeGreaterThan(1000);
      expect(layout.sections.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // F18 Boundaries: PDF & Document Table Structure Reconstructor
  // --------------------------------------------------------------------------
  describe('F18 Boundaries: Table Reconstruction Edge Cases', () => {
    test('F18-B1: Single line with tabs is not converted to table (requires at least 2 rows)', () => {
      const singleLine = ['HeaderA\tHeaderB\tHeaderC'];
      const res = pdfLoader.convertLinesToMarkdownTable(singleLine);
      expect(res).toBe('HeaderA\tHeaderB\tHeaderC');
      expect(res).not.toMatch(/\| --- \|/);
    });

    test('F18-B2: Handles rows with inconsistent column counts by padding with empty cells', () => {
      const lines = [
        'Col1\tCol2\tCol3',
        'Row1A\tRow1B', // 2 cols
        'Row2A\tRow2B\tRow2C\tRow2D', // 4 cols
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      const rows = table.split('\n');
      expect(rows).toHaveLength(4);
      expect(rows[1]).toBe('| --- | --- | --- | --- |'); // Max 4 columns
    });

    test('F18-B3: Handles table cells containing pipe characters safely without breaking syntax', () => {
      const lines = [
        'Operation\tSyntax',
        'Bitwise OR\tvalA | valB',
      ];
      const table = pdfLoader.convertLinesToMarkdownTable(lines);
      expect(table).toMatch(/valA \\\| valB/);
    });

    test('F18-B4: Handles table with 20 columns without syntax breakdown', () => {
      const headers = Array.from({ length: 20 }, (_, i) => `H${i + 1}`).join('\t');
      const values = Array.from({ length: 20 }, (_, i) => `V${i + 1}`).join('\t');
      const table = pdfLoader.convertLinesToMarkdownTable([headers, values]);
      const sep = table.split('\n')[1];
      const sepCols = sep.split('|').filter(c => c.trim().length > 0);
      expect(sepCols.length).toBe(20);
    });

    test('F18-B5: Returns raw text when input lines have zero valid column separators', () => {
      const lines = ['First normal line', 'Second normal line'];
      const res = pdfLoader.convertLinesToMarkdownTable(lines);
      expect(res).not.toMatch(/\| --- \|/);
    });
  });

  // --------------------------------------------------------------------------
  // F19 Boundaries: Contextual Document Chunker
  // --------------------------------------------------------------------------
  describe('F19 Boundaries: Document Chunker Edge Cases', () => {
    test('F19-B1: Handles chunking document containing only 1 word', () => {
      const chunks = ragEngine.chunkDocument('Transformer');
      expect(chunks.length).toBe(1);
      expect(chunks[0].tokens).toContain('transformer');
    });

    test('F19-B2: Clamps chunkOverlap if larger than half of chunkSize to prevent infinite loops', () => {
      const chunks = ragEngine.chunkDocument(sampleDocs.academicPaperText, {
        chunkSize: 200,
        chunkOverlap: 300, // Invalid overlap > chunkSize!
      });
      expect(chunks.length).toBeGreaterThan(0);
    });

    test('F19-B3: Handles document with zero section headings using default Main section', () => {
      const rawText = 'Just continuous paragraphs of research notes without any formal Markdown headings or numbers.';
      const chunks = ragEngine.chunkDocument(rawText, { title: 'Raw Notes' });
      expect(chunks[0].section).toBeDefined();
      expect(chunks[0].content).toMatch(/\[Raw Notes —/);
    });

    test('F19-B4: Handles text with zero punctuation marks gracefully', () => {
      const noPunct = 'word '.repeat(300);
      const chunks = ragEngine.chunkDocument(noPunct, { chunkSize: 200 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    test('F19-B5: Handles empty string input without throwing exception', () => {
      expect(() => ragEngine.chunkDocument('')).not.toThrow();
      const chunks = ragEngine.chunkDocument('');
      expect(chunks).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // F20 Boundaries: Zero-Dependency Hybrid RAG
  // --------------------------------------------------------------------------
  describe('F20 Boundaries: Hybrid RAG Scoring & Empty Query Edge Cases', () => {
    test('F20-B1: tokenizeWords returns empty array for empty string, null, or undefined', () => {
      expect(ragEngine.tokenizeWords('')).toHaveLength(0);
      expect(ragEngine.tokenizeWords(null)).toHaveLength(0);
      expect(ragEngine.tokenizeWords(undefined)).toHaveLength(0);
    });

    test('F20-B2: tokenizeWords strips all stopwords when query contains only stopwords', () => {
      const query = 'the and for that this with from are was were yang dan di ke dari ini';
      const tokens = ragEngine.tokenizeWords(query);
      expect(tokens).toHaveLength(0);
    });

    test('F20-B3: cosineSimilarity returns 0 when one or both vectors are empty', () => {
      const fullVec = new Map([['w:test', 2]]);
      const emptyVec = new Map();
      expect(ragEngine.cosineSimilarity(emptyVec, fullVec)).toBe(0);
      expect(ragEngine.cosineSimilarity(fullVec, emptyVec)).toBe(0);
      expect(ragEngine.cosineSimilarity(emptyVec, emptyVec)).toBe(0);
    });

    test('F20-B4: Retrieve returns empty array when query is empty string or non-string', () => {
      ragEngine.indexDocument('doc1', sampleDocs.academicPaperText);
      expect(ragEngine.retrieve('')).toHaveLength(0);
      expect(ragEngine.retrieve(null)).toHaveLength(0);
    });

    test('F20-B5: Retrieve with topK larger than total chunks returns all available chunks without crashing', () => {
      ragEngine.indexDocument('small_doc', 'Short document with two sentences for retrieval testing.');
      const hits = ragEngine.retrieve('retrieval testing', { topK: 100 });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.length).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // F21 Boundaries: Document Grounded Q&A Pipeline
  // --------------------------------------------------------------------------
  describe('F21 Boundaries: Q&A Pipeline Edge Cases', () => {
    test('F21-B1: answerWithRag returns graceful notice when RAG index is completely empty', async () => {
      ragEngine.clearIndex();
      const res = await ragEngine.answerWithRag('What is ResNet?');
      expect(res.answer).toMatch(/tidak ditemukan potongan dokumen/i);
      expect(res.citations).toHaveLength(0);
    });

    test('F21-B2: answerWithRag handles query with docId filter pointing to non-existent document', async () => {
      ragEngine.indexDocument('valid_doc', sampleDocs.academicPaperText);
      const res = await ragEngine.answerWithRag('residual learning', { docId: 'ghost_doc_id' });
      expect(res.answer).toMatch(/tidak ditemukan potongan dokumen/i);
    });

    test('F21-B3: clearIndex is idempotent and can be called repeatedly without errors', () => {
      expect(() => {
        ragEngine.clearIndex();
        ragEngine.clearIndex();
        ragEngine.clearIndex();
      }).not.toThrow();
      expect(ragEngine.getStats().totalDocuments).toBe(0);
    });

    test('F21-B4: buildGroundedPrompt handles huge query string (2000 chars) without truncation crash', () => {
      const hugeQuery = 'Bagaimana arsitektur residual '.repeat(80);
      const prompt = ragEngine.buildGroundedPrompt(hugeQuery, []);
      expect(prompt).toContain(hugeQuery);
    });

    test('F21-B5: buildGroundedPrompt handles chunks with empty citations or missing section titles', () => {
      const malformedChunk = [
        { citation: '', title: '', section: '', rawText: 'Standalone body text.' },
      ];
      expect(() => ragEngine.buildGroundedPrompt('Question', malformedChunk)).not.toThrow();
      const prompt = ragEngine.buildGroundedPrompt('Question', malformedChunk);
      expect(prompt).toMatch(/Standalone body text/);
    });
  });
});
