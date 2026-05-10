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
  });

  describe('toTsv', () => {
    test('returns tab-separated values', () => {
      const result = toTsv(SAMPLE_ITEMS);
      const lines = result.split('\n');
      expect(lines[0]).toContain('\t');
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
  });

  describe('toTxt', () => {
    test('returns readable text', () => {
      const result = toTxt(SAMPLE_ITEMS, { keyword: 'test' });
      expect(result).toContain('=== test ===');
      expect(result).toContain('[1] Test 1');
      expect(result).toContain('[2] Test 2');
    });
  });
});
