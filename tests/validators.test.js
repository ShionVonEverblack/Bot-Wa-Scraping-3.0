'use strict';

/**
 * @fileoverview Tests for validators.
 */

const { normalizeType, normalizeFormat, parseLimit } = require('../src/utils/validators');

describe('validators', () => {
  describe('normalizeType', () => {
    test('normalizes image variants', () => {
      expect(normalizeType('gambar')).toBe('images');
      expect(normalizeType('image')).toBe('images');
      expect(normalizeType('foto')).toBe('images');
      expect(normalizeType('photo')).toBe('images');
    });

    test('normalizes paper variants', () => {
      expect(normalizeType('paper')).toBe('papers');
      expect(normalizeType('jurnal')).toBe('papers');
      expect(normalizeType('artikel')).toBe('papers');
    });

    test('normalizes dataset variants', () => {
      expect(normalizeType('dataset')).toBe('datasets');
      expect(normalizeType('data')).toBe('datasets');
    });

    test('defaults to general', () => {
      expect(normalizeType('unknown')).toBe('general');
      expect(normalizeType('')).toBe('general');
      expect(normalizeType(undefined)).toBe('general');
    });
  });

  describe('normalizeFormat', () => {
    test('normalizes known formats', () => {
      expect(normalizeFormat('json')).toBe('json');
      expect(normalizeFormat('csv')).toBe('csv');
      expect(normalizeFormat('excel')).toBe('excel');
      expect(normalizeFormat('xlsx')).toBe('excel');
    });

    test('defaults to json', () => {
      expect(normalizeFormat('unknown')).toBe('json');
      expect(normalizeFormat('')).toBe('json');
    });
  });

  describe('parseLimit', () => {
    test('parses valid limits', () => {
      expect(parseLimit(5)).toBe(5);
      expect(parseLimit('20')).toBe(20);
    });

    test('clamps to range', () => {
      expect(parseLimit(0)).toBe(10);   // 0 is invalid, returns default
      expect(parseLimit(100)).toBe(50); // clamped to max
      expect(parseLimit(-5)).toBe(10);  // negative is invalid, returns default
    });

    test('defaults for invalid input', () => {
      expect(parseLimit(null)).toBe(10);
      expect(parseLimit('abc')).toBe(10);
    });
  });
});
