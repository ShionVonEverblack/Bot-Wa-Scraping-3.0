'use strict';

/**
 * @fileoverview Tests for text utility functions.
 */

const { startsWithCommand, splitArgs, stripMentions, truncate, cleanForNlp } = require('../../src/utils/text');

describe('text utils', () => {
  describe('startsWithCommand', () => {
    test('detects ! prefix', () => {
      expect(startsWithCommand('!help')).toBe(true);
      expect(startsWithCommand('!scrape keyword')).toBe(true);
    });

    test('detects / prefix', () => {
      expect(startsWithCommand('/help')).toBe(true);
    });

    test('rejects non-command text', () => {
      expect(startsWithCommand('hello world')).toBe(false);
      expect(startsWithCommand('')).toBe(false);
      expect(startsWithCommand('cari gambar')).toBe(false);
    });
  });

  describe('splitArgs', () => {
    test('splits command and args', () => {
      const result = splitArgs('!scrape machine learning --type papers');
      expect(result.command).toBe('scrape');
      expect(result.args).toContain('machine');
      expect(result.args).toContain('learning');
    });

    test('handles non-command text', () => {
      const result = splitArgs('hello');
      // splitArgs still returns the word since it strips the prefix
      expect(result.args).toBeDefined();
    });
  });

  describe('stripMentions', () => {
    test('removes @mentions', () => {
      const result = stripMentions('@628123456789 hello');
      expect(result).not.toContain('@628');
      expect(result.trim()).toContain('hello');
    });

    test('preserves text without mentions', () => {
      expect(stripMentions('hello world')).toBe('hello world');
    });
  });

  describe('truncate', () => {
    test('truncates long text', () => {
      const long = 'a'.repeat(100);
      const result = truncate(long, 20);
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    test('returns short text unchanged', () => {
      expect(truncate('short', 20)).toBe('short');
    });
  });
});
