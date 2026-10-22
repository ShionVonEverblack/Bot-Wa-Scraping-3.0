'use strict';

/**
 * @fileoverview Tests for contextMemory — per-user conversation context with TTL.
 */

const contextMemory = require('../../src/bot/nlp/contextMemory');

// Clear all state before each test
beforeEach(() => {
  contextMemory.stopCleanup();
  // Clear internal store via the public API
  // We'll store and clear a known user to reset
  contextMemory.clear('test-reset');
});

afterAll(() => {
  contextMemory.stopCleanup();
});

describe('contextMemory', () => {
  describe('store and get', () => {
    test('stores and retrieves user context', () => {
      contextMemory.store('user-1', { lastKeyword: 'machine learning' });
      const ctx = contextMemory.get('user-1');
      expect(ctx).toBeDefined();
      expect(ctx.lastKeyword).toBe('machine learning');
      expect(ctx.userId).toBe('user-1');
    });

    test('updates existing context fields', () => {
      contextMemory.store('user-2', { lastKeyword: 'deep learning' });
      contextMemory.store('user-2', { lastType: 'papers' });

      const ctx = contextMemory.get('user-2');
      expect(ctx.lastKeyword).toBe('deep learning');
      expect(ctx.lastType).toBe('papers');
    });

    test('stores lastJobId and lastIntent', () => {
      contextMemory.store('user-3', {
        lastJobId: 'JOB-123',
        lastIntent: 'SCRAPE',
      });

      const ctx = contextMemory.get('user-3');
      expect(ctx.lastJobId).toBe('JOB-123');
      expect(ctx.lastIntent).toBe('SCRAPE');
    });

    test('returns null for unknown user', () => {
      expect(contextMemory.get('nonexistent-user')).toBeNull();
    });

    test('returns null for null/empty userId', () => {
      expect(contextMemory.get(null)).toBeNull();
      expect(contextMemory.get('')).toBeNull();
    });

    test('store ignores null userId', () => {
      const before = contextMemory.size();
      contextMemory.store(null, { lastKeyword: 'test' });
      expect(contextMemory.size()).toBe(before);
    });
  });

  describe('message history', () => {
    test('adds messages to history', () => {
      contextMemory.store('user-msg', {
        message: { role: 'user', content: 'Hello' },
      });
      contextMemory.store('user-msg', {
        message: { role: 'assistant', content: 'Hi there!' },
      });

      const ctx = contextMemory.get('user-msg');
      expect(ctx.messages).toHaveLength(2);
      expect(ctx.messages[0].role).toBe('user');
      expect(ctx.messages[0].content).toBe('Hello');
      expect(ctx.messages[1].role).toBe('assistant');
    });

    test('defaults message role to user', () => {
      contextMemory.store('user-def', {
        message: { content: 'no role specified' },
      });

      const ctx = contextMemory.get('user-def');
      expect(ctx.messages[0].role).toBe('user');
    });

    test('trims history beyond MAX_HISTORY (20)', () => {
      for (let i = 0; i < 25; i++) {
        contextMemory.store('user-trim', {
          message: { role: 'user', content: `message ${i}` },
        });
      }

      const ctx = contextMemory.get('user-trim');
      expect(ctx.messages).toHaveLength(20);
      // Oldest messages should be trimmed, newest kept
      expect(ctx.messages[0].content).toBe('message 5');
      expect(ctx.messages[19].content).toBe('message 24');
    });
  });

  describe('clear', () => {
    test('clears user context', () => {
      contextMemory.store('user-clear', { lastKeyword: 'test' });
      expect(contextMemory.get('user-clear')).not.toBeNull();

      contextMemory.clear('user-clear');
      expect(contextMemory.get('user-clear')).toBeNull();
    });

    test('clear ignores null userId', () => {
      // Should not throw
      contextMemory.clear(null);
      contextMemory.clear('');
    });
  });

  describe('size', () => {
    test('returns number of active contexts', () => {
      const baseBefore = contextMemory.size();
      contextMemory.store('size-1', { lastKeyword: 'a' });
      contextMemory.store('size-2', { lastKeyword: 'b' });
      expect(contextMemory.size()).toBe(baseBefore + 2);
    });
  });

  describe('TTL expiry', () => {
    test('expired context returns null', () => {
      contextMemory.store('user-ttl', { lastKeyword: 'expired' });

      // Manually set updatedAt to past (> 30 min ago)
      const ctx = contextMemory.get('user-ttl');
      ctx.updatedAt = Date.now() - (31 * 60 * 1000);

      // Should now return null (expired)
      expect(contextMemory.get('user-ttl')).toBeNull();
    });
  });

  describe('cleanup timer', () => {
    test('startCleanup and stopCleanup work without errors', () => {
      expect(() => contextMemory.startCleanup()).not.toThrow();
      expect(() => contextMemory.stopCleanup()).not.toThrow();
    });

    test('double startCleanup does not throw', () => {
      contextMemory.startCleanup();
      expect(() => contextMemory.startCleanup()).not.toThrow();
      contextMemory.stopCleanup();
    });

    test('cleanup timer evicts expired entries', () => {
      jest.useFakeTimers();
      
      // Stop any existing cleanup timer from beforeEach
      contextMemory.stopCleanup();

      const baseSize = contextMemory.size();

      // Store an entry
      contextMemory.store('user-cleanup', { lastKeyword: 'cleanup' });
      const ctx = contextMemory.get('user-cleanup');
      expect(ctx).not.toBeNull();
      expect(contextMemory.size()).toBe(baseSize + 1);

      // Make it expired
      ctx.updatedAt = Date.now() - (31 * 60 * 1000); // 31 mins old

      // Start cleanup and advance time past the interval
      contextMemory.startCleanup();
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000); // 5 min 1 sec

      // Should be deleted
      // Can't use get() because get() itself checks TTL. We check size() to ensure cleanup deleted it.
      expect(contextMemory.size()).toBe(baseSize);

      contextMemory.stopCleanup();
      jest.useRealTimers();
    });
  });
});
