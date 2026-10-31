'use strict';

/**
 * @fileoverview In-memory operational metrics and live telemetry recorder for Rima Bot.
 * Tracks message volume, command usage, AI provider activity, and provides structured snapshots for Dashboard v2.0.
 * @module services/monitor/stats
 */

const startedAt = Date.now();

const state = {
  messages: {
    total: 0,
    dm: 0,
    group: 0,
  },
  commands: {
    total: 0,
    byName: {},
  },
  ai: {
    totalCalls: 0,
    lastProvider: null,
    byProvider: {},
  },
};

/**
 * Record an incoming WhatsApp message.
 * @param {Object} [details]
 * @param {boolean} [details.isGroup=false]
 */
function recordMessage(details = {}) {
  state.messages.total++;
  if (details.isGroup) {
    state.messages.group++;
  } else {
    state.messages.dm++;
  }
}

/**
 * Record a command execution.
 * @param {string} commandName
 */
function recordCommand(commandName) {
  if (!commandName) return;
  state.commands.total++;
  const name = String(commandName).toLowerCase().replace(/^!/, '');
  state.commands.byName[name] = (state.commands.byName[name] || 0) + 1;
}

/**
 * Record an AI provider invocation.
 * @param {string} providerName
 */
function recordAiProvider(providerName) {
  if (!providerName) return;
  const name = String(providerName).toLowerCase();
  state.ai.totalCalls++;
  state.ai.lastProvider = name;
  state.ai.byProvider[name] = (state.ai.byProvider[name] || 0) + 1;
}

/**
 * Get a complete snapshot of in-memory metrics.
 * @returns {Object}
 */
function snapshot() {
  return {
    startedAt,
    messages: { ...state.messages },
    commands: {
      total: state.commands.total,
      byName: { ...state.commands.byName },
    },
    ai: {
      totalCalls: state.ai.totalCalls,
      lastProvider: state.ai.lastProvider,
      byProvider: { ...state.ai.byProvider },
    },
  };
}

/**
 * Reset metrics (useful for testing).
 */
function reset() {
  state.messages.total = 0;
  state.messages.dm = 0;
  state.messages.group = 0;
  state.commands.total = 0;
  state.commands.byName = {};
  state.ai.totalCalls = 0;
  state.ai.lastProvider = null;
  state.ai.byProvider = {};
}

module.exports = {
  recordMessage,
  recordCommand,
  recordAiProvider,
  snapshot,
  reset,
};
