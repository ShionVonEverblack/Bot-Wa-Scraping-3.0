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

  test('transitions to HALF_OPEN after timeout', () => {
    jest.useFakeTimers();
    
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('test-provider');
    }
    expect(cb.isOpen('test-provider')).toBe(true);

    // Advance time past RESET_TIMEOUT (60000ms)
    jest.advanceTimersByTime(60001);

    // Should be false (allowing attempt) and state should be HALF_OPEN internally
    expect(cb.isOpen('test-provider')).toBe(false);
    expect(cb.getAllStates()['test-provider'].state).toBe(cb.STATES.HALF_OPEN);

    // Second call before success/failure should still allow attempt
    expect(cb.isOpen('test-provider')).toBe(false);

    jest.useRealTimers();
  });

  test('recovers from HALF_OPEN on success', () => {
    jest.useFakeTimers();
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('test-provider');
    }
    
    jest.advanceTimersByTime(60001);
    expect(cb.isOpen('test-provider')).toBe(false); // Transitions to HALF_OPEN
    
    cb.recordSuccess('test-provider');
    expect(cb.getAllStates()['test-provider'].state).toBe(cb.STATES.CLOSED);
    
    jest.useRealTimers();
  });
});
