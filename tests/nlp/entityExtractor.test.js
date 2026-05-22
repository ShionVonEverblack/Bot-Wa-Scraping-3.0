'use strict';

/**
 * @fileoverview Tests for entity extractor.
 */

const { extractEntities, extractIdentifier } = require('../../src/bot/nlp/entityExtractor');

describe('entityExtractor', () => {
  describe('extractEntities', () => {
    test('extracts keyword from scrape text', () => {
      const result = extractEntities('cari gambar kucing lucu', 'SCRAPE');
      expect(result.keyword).toBe('kucing lucu'); // 'cari' and 'gambar' are removed
      expect(result.type).toBe('images');
    });

    test('extracts "limit N" syntax', () => {
      const result = extractEntities('cari paper ai limit 5', 'SCRAPE');
      expect(result.limit).toBe(5);
      expect(result.type).toBe('papers');
      expect(result.keyword).toBe('ai');
    });

    test('extracts "top N" syntax', () => {
      const result = extractEntities('top 10 paper machine learning', 'SCRAPE');
      expect(result.limit).toBe(10);
      expect(result.type).toBe('papers');
      expect(result.keyword).toBe('machine learning');
    });

    test('extracts "N hasil" syntax', () => {
      const result = extractEntities('cari 3 hasil foto kucing', 'SCRAPE');
      expect(result.limit).toBe(3);
      expect(result.type).toBe('images');
      expect(result.keyword).toBe('kucing');
    });

    test('extracts "--format" syntax', () => {
      const result = extractEntities('scrape paper ai --format csv', 'SCRAPE');
      expect(result.format).toBe('csv');
      expect(result.keyword).toBe('ai');
    });

    test('extracts "--ai" syntax', () => {
      const result = extractEntities('scrape google lucu --ai', 'SCRAPE');
      expect(result.useAI).toBe(true);
      expect(result.keyword).toBe('google lucu');
    });

    test('defaults to general type when no type keyword found', () => {
      const result = extractEntities('cari resep masakan', 'SCRAPE');
      expect(result.type).toBe('general');
      expect(result.keyword).toBe('resep masakan');
    });

    test('handles empty or null text', () => {
      const r1 = extractEntities(null, 'SCRAPE');
      expect(r1.keyword).toBe('');
      expect(r1.type).toBe('general');

      const r2 = extractEntities('', 'SCRAPE');
      expect(r2.keyword).toBe('');
      expect(r2.type).toBe('general');
    });
  });

  describe('extractIdentifier', () => {
    test('extracts DOI', () => {
      const result = extractIdentifier('download 10.1038/s41586-020-2649-2');
      expect(result).toContain('10.1038');
    });

    test('extracts arXiv ID', () => {
      const result = extractIdentifier('paper arXiv:2301.07041');
      expect(result).toContain('2301.07041');
    });

    test('returns null for no identifier', () => {
      const result = extractIdentifier('hello world');
      expect(result).toBeNull();
    });
  });
});
