'use strict';

/**
 * @fileoverview Tests for time utilities.
 */

const { formatDuration, nowIso, parseInterval } = require('../../src/utils/time');

describe('time utils', () => {
  describe('formatDuration', () => {
    test('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    test('formats seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
    });

    test('formats minutes', () => {
      const result = formatDuration(125000);
      expect(result).toContain('m');
    });

    test('formats hours', () => {
      const result = formatDuration(3700000);
      expect(result).toContain('h');
    });
  });

  describe('nowIso', () => {
    test('returns valid ISO string', () => {
      const iso = nowIso();
      expect(new Date(iso).toISOString()).toBe(iso);
    });
  });
});
