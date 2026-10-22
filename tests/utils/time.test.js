'use strict';

/**
 * @fileoverview Tests for time utilities.
 */

const { formatDuration, nowIso, parseTime } = require('../../src/utils/time');

describe('time utils', () => {
  describe('formatDuration', () => {
    test('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    test('formats seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(1000)).toBe('1s');
    });

    test('formats minutes with remaining seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    test('formats exact minutes', () => {
      expect(formatDuration(60000)).toBe('1m');
      expect(formatDuration(120000)).toBe('2m');
    });

    test('formats hours with remaining minutes', () => {
      expect(formatDuration(3900000)).toBe('1h 5m');
    });

    test('formats exact hours', () => {
      expect(formatDuration(3600000)).toBe('1h');
    });

    test('handles negative values', () => {
      expect(formatDuration(-500)).toBe('0ms');
    });
  });

  describe('nowIso', () => {
    test('returns valid ISO string', () => {
      const iso = nowIso();
      expect(new Date(iso).toISOString()).toBe(iso);
    });
  });

  describe('parseTime', () => {
    test('parses named intervals', () => {
      expect(parseTime('daily')).toBe(86400000);
      expect(parseTime('weekly')).toBe(604800000);
      expect(parseTime('hourly')).toBe(3600000);
    });

    test('parses seconds', () => {
      expect(parseTime('30s')).toBe(30000);
      expect(parseTime('1s')).toBe(1000);
    });

    test('parses minutes', () => {
      expect(parseTime('5m')).toBe(300000);
      expect(parseTime('1m')).toBe(60000);
    });

    test('parses hours', () => {
      expect(parseTime('1h')).toBe(3600000);
      expect(parseTime('2h')).toBe(7200000);
    });

    test('parses days', () => {
      expect(parseTime('1d')).toBe(86400000);
      expect(parseTime('7d')).toBe(604800000);
    });

    test('parses milliseconds', () => {
      expect(parseTime('500ms')).toBe(500);
    });

    test('handles case insensitivity', () => {
      expect(parseTime('Daily')).toBe(86400000);
      expect(parseTime('HOURLY')).toBe(3600000);
    });

    test('handles whitespace', () => {
      expect(parseTime('  30s  ')).toBe(30000);
    });

    test('returns null for invalid input', () => {
      expect(parseTime(null)).toBeNull();
      expect(parseTime('')).toBeNull();
      expect(parseTime('abc')).toBeNull();
      expect(parseTime('hello world')).toBeNull();
      expect(parseTime(undefined)).toBeNull();
    });

    test('returns null for non-string input', () => {
      expect(parseTime(123)).toBeNull();
    });
  });
});

