'use strict';

/**
 * @fileoverview Circuit breaker — per-provider failure tracking and auto-recovery.
 * @module services/resilience/circuitBreaker
 */

const config = require('../../config');
const { createLogger } = require('../monitor/logger');

const log = createLogger('resilience:cb');

/** @type {Map<string, { failures: number, state: string, lastFailure: number, nextRetry: number }>} */
const circuits = new Map();

const FAILURE_THRESHOLD = config.resilience?.cbFailureThreshold || 5;
const RESET_TIMEOUT = config.resilience?.cbResetTimeoutMs || 60000;

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

/**
 * Get or create circuit state for a provider.
 * @param {string} providerId
 * @returns {Object}
 */
function getCircuit(providerId) {
  if (!circuits.has(providerId)) {
    circuits.set(providerId, {
      failures: 0,
      state: STATES.CLOSED,
      lastFailure: 0,
      nextRetry: 0,
    });
  }
  return circuits.get(providerId);
}

/**
 * Check if a provider circuit is open (should be skipped).
 * @param {string} providerId
 * @returns {boolean} true if provider should be skipped
 */
function isOpen(providerId) {
  const circuit = getCircuit(providerId);

  if (circuit.state === STATES.CLOSED) return false;

  if (circuit.state === STATES.OPEN) {
    // Check if reset timeout has passed
    if (Date.now() >= circuit.nextRetry) {
      circuit.state = STATES.HALF_OPEN;
      log.info(`Circuit half-open: ${providerId}`);
      return false; // Allow one attempt
    }
    return true; // Still open
  }

  // HALF_OPEN — allow attempt
  return false;
}

/**
 * Record a successful call — reset the circuit.
 * @param {string} providerId
 */
function recordSuccess(providerId) {
  const circuit = getCircuit(providerId);
  if (circuit.state !== STATES.CLOSED) {
    log.info(`Circuit closed (recovered): ${providerId}`);
  }
  circuit.failures = 0;
  circuit.state = STATES.CLOSED;
}

/**
 * Record a failed call — increment failures, trip circuit if threshold reached.
 * @param {string} providerId
 */
function recordFailure(providerId) {
  const circuit = getCircuit(providerId);
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = STATES.OPEN;
    circuit.nextRetry = Date.now() + RESET_TIMEOUT;
    log.warn(`Circuit OPEN: ${providerId} (${circuit.failures} failures, retry at ${new Date(circuit.nextRetry).toISOString()})`);
  }
}

/**
 * Get all circuit states.
 * @returns {Object}
 */
function getAllStates() {
  const result = {};
  for (const [id, circuit] of circuits) {
    result[id] = { ...circuit };
  }
  return result;
}

/**
 * Reset a specific circuit.
 * @param {string} providerId
 */
function reset(providerId) {
  circuits.delete(providerId);
  log.info(`Circuit reset: ${providerId}`);
}

module.exports = { isOpen, recordSuccess, recordFailure, getAllStates, reset, STATES };
