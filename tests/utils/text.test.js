'use strict';

/**
 * @fileoverview Tests for text utility functions.
 */

const { startsWithCommand, splitArgs, isWizardTrigger, stripMentions, truncate } = require('../../src/utils/text');

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

    test('handles null/undefined/non-string', () => {
      expect(startsWithCommand(null)).toBe(false);
      expect(startsWithCommand(undefined)).toBe(false);
      expect(startsWithCommand(123)).toBe(false);
    });

    test('handles whitespace before prefix', () => {
      expect(startsWithCommand('  !help')).toBe(true);
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
      expect(result.command).toBe('hello');
      expect(result.args).toHaveLength(0);
    });

    test('handles null/empty input', () => {
      const result = splitArgs(null);
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
      expect(result.raw).toBe('');
    });

    test('preserves raw args text', () => {
      const result = splitArgs('!scrape deep learning papers');
      expect(result.raw).toBe('deep learning papers');
    });
  });

  describe('isWizardTrigger', () => {
    test('detects exact greetings', () => {
      expect(isWizardTrigger('hai')).toBe(true);
      expect(isWizardTrigger('halo')).toBe(true);
      expect(isWizardTrigger('hello')).toBe(true);
      expect(isWizardTrigger('hi')).toBe(true);
      expect(isWizardTrigger('hey')).toBe(true);
      expect(isWizardTrigger('bot')).toBe(true);
      expect(isWizardTrigger('p')).toBe(true);
    });

    test('detects greetings case-insensitively', () => {
      expect(isWizardTrigger('HAI')).toBe(true);
      expect(isWizardTrigger('Hello')).toBe(true);
      expect(isWizardTrigger('HALO')).toBe(true);
    });

    test('detects greeting followed by text', () => {
      expect(isWizardTrigger('hai bot')).toBe(true);
      expect(isWizardTrigger('hello there')).toBe(true);
      expect(isWizardTrigger('selamat pagi')).toBe(true);
    });

    test('rejects non-greeting text', () => {
      expect(isWizardTrigger('search for data')).toBe(false);
      expect(isWizardTrigger('!help')).toBe(false);
      expect(isWizardTrigger('machine learning')).toBe(false);
    });

    test('handles null/empty', () => {
      expect(isWizardTrigger(null)).toBe(false);
      expect(isWizardTrigger('')).toBe(false);
      expect(isWizardTrigger(undefined)).toBe(false);
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

    test('handles null/empty', () => {
      expect(stripMentions(null)).toBe('');
      expect(stripMentions('')).toBe('');
    });

    test('removes multiple mentions', () => {
      const result = stripMentions('@111 @222 hey');
      expect(result).not.toContain('@');
      expect(result).toContain('hey');
    });
  });

  describe('truncate', () => {
    test('truncates long text', () => {
      const long = 'a'.repeat(100);
      const result = truncate(long, 20);
      expect(result.length).toBe(20);
      expect(result).toContain('...');
    });

    test('returns short text unchanged', () => {
      expect(truncate('short', 20)).toBe('short');
    });

    test('handles null/undefined/non-string', () => {
      expect(truncate(null)).toBe('');
      expect(truncate(undefined)).toBe('');
      expect(truncate(123)).toBe('');
    });

    test('handles exact length text', () => {
      const text = 'a'.repeat(20);
      expect(truncate(text, 20)).toBe(text); // exact length, no truncation
    });
  });
});

