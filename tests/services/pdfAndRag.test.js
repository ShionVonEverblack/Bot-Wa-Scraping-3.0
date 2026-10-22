'use strict';

/**
 * @fileoverview Tests for OpenDataLoader-PDF layout parser and RAGFlow Deep RAG Engine.
 */

const {
  extractLayoutStructure,
  detectHeading,
  convertLinesToMarkdownTable,
  parseBuffer,
} = require('../../src/services/pdf/pdfLoader');
const ragEngine = require('../../src/services/rag/ragEngine');

describe('pdfLoader (OpenDataLoader-PDF) & ragEngine (RAGFlow)', () => {
  beforeEach(() => {
    ragEngine.clearIndex();
  });

  test('detectHeading identifies academic headings, numbered sections, and markdown headings', () => {
    expect(detectHeading('Abstract')).toEqual({ level: 2, title: 'Abstract' });
    expect(detectHeading('2.1. Experimental Setup')).toEqual({
      level: 3,
      title: '2.1. Experimental Setup',
    });
    expect(detectHeading('### Evaluation Metrics')).toEqual({
      level: 3,
      title: 'Evaluation Metrics',
    });
    expect(detectHeading('This is a regular sentence that ends with a period.')).toBeNull();
  });

  test('extractLayoutStructure de-hyphenates words, strips page numbers, and builds sections & tables', () => {
    const rawPdfText = [
      'Deep Graph RAG Architecture',
      '-- 1 of 5 --',
      'Abstract',
      'We propose a novel trans-',
      'former retrieval architecture for scientific documents.',
      '1. Methodology',
      'Our system combines BM25 lexical search with dense trigram vectors.',
      'Model\tPrecision\tRecall',
      'BM25\t0.78\t0.72',
      'Hybrid-RRF\t0.91\t0.89',
      'Page 2 of 5',
      'Conclusion',
      'Hybrid RRF improves recall by 17% across all benchmarks.',
    ].join('\n');

    const doc = extractLayoutStructure(rawPdfText);

    expect(doc.title).toBe('Deep Graph RAG Architecture');
    expect(doc.markdown).toContain('transformer retrieval architecture');
    expect(doc.markdown).not.toContain('-- 1 of 5 --');
    expect(doc.markdown).not.toContain('Page 2 of 5');
    expect(doc.sections.map(s => s.heading)).toContain('Abstract');
    expect(doc.sections.map(s => s.heading)).toContain('1. Methodology');
    expect(doc.sections.map(s => s.heading)).toContain('Conclusion');
    expect(doc.tables.length).toBe(1);
    expect(doc.tables[0]).toContain('| Model | Precision | Recall |');
    expect(doc.tables[0]).toContain('| Hybrid-RRF | 0.91 | 0.89 |');
  });

  test('parseBuffer gracefully handles text buffer fallback when not a binary PDF', async () => {
    const buf = Buffer.from('Sample Title\n\nAbstract\nThis is a test document body.', 'utf-8');
    const parsed = await parseBuffer(buf, { title: 'Custom Title' });
    expect(parsed.title).toBe('Custom Title');
    expect(parsed.markdown).toContain('This is a test document body.');
  });

  test('ragEngine indexes structured documents and retrieves grounded chunks via Hybrid BM25 + Vector RRF', async () => {
    const sampleDoc = [
      'Quantum Error Correction Paper',
      'Abstract',
      'Surface codes require topological stabilizers to suppress decoherence in superconducting qubits.',
      '1. Experimental Results',
      'We achieved a logical error rate of 0.0012 per cycle using 49 physical transmon qubits at 15 millikelvin.',
      '2. Conclusion',
      'Decoherence suppression scales exponentially with code distance.',
    ].join('\n');

    const indexed = ragEngine.indexDocument('quantum_paper', sampleDoc, {
      title: 'Quantum Error Correction Paper',
      chunkSize: 220,
      chunkOverlap: 40,
    });

    expect(indexed.chunkCount).toBeGreaterThanOrEqual(2);

    const hits = ragEngine.retrieve('What logical error rate was achieved with transmon qubits?', {
      topK: 2,
    });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].rawText).toContain('0.0012');
    expect(hits[0].citation).toBe('[1]');
    expect(hits[0].rrfScore).toBeGreaterThan(0);

    const prompt = ragEngine.buildGroundedPrompt('What logical error rate?', hits);
    expect(prompt).toContain('[1]');
    expect(prompt).toContain('0.0012');

    const ragResponse = await ragEngine.answerWithRag('logical error rate transmon qubits');
    expect(ragResponse.answer).toContain('[1]');
    expect(ragResponse.citations.length).toBeGreaterThan(0);
  });

  test('parseBuffer extracts real text from binary %PDF-1.4 buffers (including FlateDecode streams) and populates section page/bbox metadata', async () => {
    const zlib = require('zlib');
    const streamContent = [
      'BT',
      '/F1 16 Tf',
      '72 720 Td',
      '(Autonomous Graph Agents) Tj',
      '0 -24 Td',
      '(Abstract) Tj',
      '0 -18 Td',
      '[(We evaluate ) -50 (hybrid retrieval accuracy at 94.6%.)] TJ',
      'ET',
    ].join('\n');
    const compressed = zlib.deflateSync(Buffer.from(streamContent, 'latin1'));

    const header = Buffer.from(
      '%PDF-1.4\n' +
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
        '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n' +
        '5 0 obj << /Title (Autonomous Graph Agents PDF) >> endobj\n' +
        `4 0 obj << /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,
      'latin1'
    );
    const footer = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
    const pdfBuffer = Buffer.concat([header, compressed, footer]);

    const parsed = await parseBuffer(pdfBuffer);
    expect(parsed.pageCount).toBe(1);
    expect(parsed.title).toBe('Autonomous Graph Agents PDF');
    expect(parsed.markdown).toContain('We evaluate hybrid retrieval accuracy at 94.6%.');
    expect(parsed.markdown).not.toContain('%PDF-1.4');
    expect(parsed.sections.length).toBeGreaterThanOrEqual(1);
    expect(parsed.sections[0].page).toBeGreaterThanOrEqual(1);
    expect(parsed.sections[0].bbox).toEqual(
      expect.objectContaining({ x: 72, width: 468 })
    );
  });

  test('chunkDocument (structureAwareChunk) keeps Markdown tables atomic across chunk boundaries', () => {
    const docWithTable = [
      '# Benchmark Report',
      '## 1. Results',
      'Introductory paragraph before the benchmark comparison table. '.repeat(3),
      '| System | Precision | Recall | Latency |',
      '| --- | --- | --- | --- |',
      '| Firecrawl | 0.94 | 0.91 | 120ms |',
      '| Crawl4AI | 0.95 | 0.93 | 95ms |',
      '| Scrapling | 0.96 | 0.94 | 80ms |',
      'Concluding analysis paragraph after the table.',
    ].join('\n');

    const chunks = ragEngine.structureAwareChunk(docWithTable, {
      chunkSize: 150,
      chunkOverlap: 30,
      docId: 'table_doc',
    });

    const tableChunk = chunks.find(c => c.rawText.includes('| System | Precision | Recall | Latency |'));
    expect(tableChunk).toBeDefined();
    expect(tableChunk.rawText).toContain('| Firecrawl | 0.94 | 0.91 | 120ms |');
    expect(tableChunk.rawText).toContain('| Scrapling | 0.96 | 0.94 | 80ms |');
  });
});
