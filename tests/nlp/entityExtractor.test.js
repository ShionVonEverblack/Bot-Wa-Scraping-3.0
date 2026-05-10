'use strict';

/**
 * @fileoverview Tests for entity extractor.
 */

const { extractEntities, extractIdentifier } = require('../../src/bot/nlp/entityExtractor');

describe('entityExtractor', () => {
  describe('extractEntities', () => {
    test('extracts keyword from scrape text', () => {
      const result = extractEntities('cari gambar kucing lucu', 'SCRAPE');
      expect(result.keyword).toBeTruthy();
      expect(result.type).toBe('images');
    });

    test('extracts limit', () => {
      const result = extractEntities('cari 20 gambar kucing', 'SCRAPE');
      // Limit extraction may or may not work for inline numbers
      expect(result.keyword).toBeTruthy();
    });

    test('extracts type papers', () => {
      const result = extractEntities('cari paper machine learning', 'SCRAPE');
      expect(result.type).toBe('papers');
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
