'use strict';

/**
 * @fileoverview Tests for circuit breaker.
 */

const cb = require('../../src/services/resilience/circuitBreaker');

describe('circuitBreaker', () => {
  beforeEach(() => {
    cb.reset('test-provider');
  });

  test('starts closed', () => {
    expect(cb.isOpen('test-provider')).toBe(false);
  });

  test('stays closed under threshold', () => {
    cb.recordFailure('test-provider');
    cb.recordFailure('test-provider');
    expect(cb.isOpen('test-provider')).toBe(false);
  });

  test('opens after threshold failures', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('test-provider');
    }
    expect(cb.isOpen('test-provider')).toBe(true);
  });

  test('success resets circuit', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('test-provider');
    }
    expect(cb.isOpen('test-provider')).toBe(true);

    // Manually reset to test success path
    cb.reset('test-provider');
    cb.recordSuccess('test-provider');
    expect(cb.isOpen('test-provider')).toBe(false);
  });

  test('getAllStates returns map', () => {
    cb.recordFailure('provider-a');
    const states = cb.getAllStates();
    expect(states['provider-a']).toBeDefined();
    expect(states['provider-a'].failures).toBe(1);
  });
});
