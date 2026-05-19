'use strict';

/**
 * @fileoverview Tests for cache service.
 */

const cache = require('../../src/services/cache');

describe('cache', () => {
  beforeEach(() => {
    cache.clear();
  });

  test('get/set basic', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('expires after TTL', async () => {
    cache.set('expire', 'val', 50); // 50ms TTL
    expect(cache.get('expire')).toBe('val');
    await new Promise(r => setTimeout(r, 100));
    expect(cache.get('expire')).toBeNull();
  });

  test('has() works', () => {
    cache.set('exists', 'yes');
    expect(cache.has('exists')).toBe(true);
    expect(cache.has('nope')).toBe(false);
  });

  test('del() removes key', () => {
    cache.set('todelete', 'val');
    cache.del('todelete');
    expect(cache.get('todelete')).toBeNull();
  });

  test('makeKey generates consistent keys', () => {
    const key1 = cache.makeKey('test', { a: 1, b: 2 });
    const key2 = cache.makeKey('test', { b: 2, a: 1 });
    expect(key1).toBe(key2); // Same regardless of order
  });

  test('stats returns size', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const s = cache.stats();
    expect(s.size).toBe(2);
    expect(s.maxSize).toBe(500);
  });

  test('stats cleans expired entries', async () => {
    cache.set('fast', 'val', 30);
    cache.set('slow', 'val', 5000);

    await new Promise(r => setTimeout(r, 50));

    const s = cache.stats();
    // 'fast' should be cleaned up, only 'slow' remains
    expect(s.size).toBe(1);
  });

  test('clear removes all entries', () => {
    cache.set('x', 1);
    cache.set('y', 2);
    cache.set('z', 3);
    cache.clear();
    expect(cache.stats().size).toBe(0);
    expect(cache.get('x')).toBeNull();
  });

  test('overwrite existing key', () => {
    cache.set('dup', 'first');
    cache.set('dup', 'second');
    expect(cache.get('dup')).toBe('second');
  });

  test('stores objects and arrays', () => {
    const data = { items: [1, 2, 3], meta: { total: 3 } };
    cache.set('complex', data);
    expect(cache.get('complex')).toEqual(data);
  });

  test('has returns false for expired key', async () => {
    cache.set('willExpire', 'val', 30);
    await new Promise(r => setTimeout(r, 50));
    expect(cache.has('willExpire')).toBe(false);
  });

  test('makeKey with different prefixes produces different keys', () => {
    const key1 = cache.makeKey('scrape', { keyword: 'test' });
    const key2 = cache.makeKey('paper', { keyword: 'test' });
    expect(key1).not.toBe(key2);
  });
});
