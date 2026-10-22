'use strict';

/**
 * @fileoverview Tests for formatters.
 */

const { toJson, toCsv, toTsv, toHtml, toSql, toTxt } = require('../../src/services/formatters');

const SAMPLE_ITEMS = [
  { title: 'Test 1', url: 'https://example.com/1', description: 'Description 1' },
  { title: 'Test 2', url: 'https://example.com/2', description: 'Description 2' },
  { title: 'Test, with "quotes"', url: 'https://example.com/3', description: 'Has, commas' },
];

describe('formatters', () => {
  describe('toJson', () => {
    test('returns valid JSON', () => {
      const result = toJson(SAMPLE_ITEMS);
      const parsed = JSON.parse(result);
      expect(parsed.data).toHaveLength(3);
      expect(parsed.count).toBe(3);
    });
  });

  describe('toCsv', () => {
    test('returns CSV with headers', () => {
      const result = toCsv(SAMPLE_ITEMS);
      const lines = result.split('\n');
      expect(lines[0]).toBe('title,url,description');
      expect(lines.length).toBe(4); // header + 3 rows
    });

    test('escapes commas and quotes', () => {
      const result = toCsv(SAMPLE_ITEMS);
      expect(result).toContain('"Test, with ""quotes"""');
    });

    test('handles empty array', () => {
      expect(toCsv([])).toBe('');
    });

    test('handles null/undefined values', () => {
      const result = toCsv([{ a: null, b: undefined, c: 'text' }]);
      expect(result.split('\n')[1]).toBe(',,text');
    });
  });

  describe('toTsv', () => {
    test('returns tab-separated values', () => {
      const result = toTsv(SAMPLE_ITEMS);
      const lines = result.split('\n');
      expect(lines[0]).toContain('\t');
    });

    test('handles empty array', () => {
      expect(toTsv([])).toBe('');
    });

    test('handles null/undefined and replaces tabs/newlines', () => {
      const result = toTsv([{ a: null, b: 'multi\nline\ttext' }]);
      expect(result.split('\n')[1]).toBe('\tmulti line text');
    });
  });

  describe('toHtml', () => {
    test('returns HTML with table', () => {
      const result = toHtml(SAMPLE_ITEMS);
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<table>');
      expect(result).toContain('Test 1');
    });

    test('handles empty items', () => {
      expect(toHtml([])).toBe('<p>No data</p>');
    });

    test('handles null values and escapes HTML', () => {
      const result = toHtml([{ a: null, b: '<script>' }]);
      expect(result).toContain('<td></td>');
      expect(result).toContain('<td>&lt;script&gt;</td>');
    });
  });

  describe('toSql', () => {
    test('returns CREATE TABLE and INSERT', () => {
      const result = toSql(SAMPLE_ITEMS);
      expect(result).toContain('CREATE TABLE');
      expect(result).toContain('INSERT INTO');
    });

    test('escapes single quotes', () => {
      const items = [{ name: "O'Brien" }];
      const result = toSql(items);
      expect(result).toContain("O''Brien");
    });

    test('handles empty array', () => {
      expect(toSql([])).toBe('');
    });

    test('handles null, numbers, and booleans', () => {
      const items = [{ a: null, b: 123, c: true, d: false }];
      const result = toSql(items);
      expect(result).toContain('VALUES (NULL, 123, 1, 0)');
    });
  });

  describe('toTxt', () => {
    test('returns readable text', () => {
      const result = toTxt(SAMPLE_ITEMS, { keyword: 'test' });
      expect(result).toContain('=== test ===');
      expect(result).toContain('[1] Test 1');
      expect(result).toContain('[2] Test 2');
    });

    test('handles missing title', () => {
      const result = toTxt([{ url: 'example.com' }]);
      expect(result).toContain('Untitled');
    });

    test('handles empty meta', () => {
      const result = toTxt(SAMPLE_ITEMS); // No meta argument
      expect(result).toContain('=== Results ===');
      expect(result).toContain('Provider: -');
    });
  });
});
