'use strict';

/**
 * @fileoverview Wizard state machine — manages step-by-step guided flow per user.
 * Steps: keyword → type → limit → confirm → execute
 * @module bot/wizard/wizardStateMachine
 */

const PROMPTS = require('./wizardPrompts');
const { validateKeyword, validateType, validateLimit, validateConfirm } = require('./wizardValidators');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('bot:wizard');

/** @type {Map<string, Object>} Active wizard sessions per userId. */
const sessions = new Map();

const STEPS = ['keyword', 'type', 'limit', 'confirm'];
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Start a new wizard session.
 * @param {string} userId
 * @returns {string} First prompt
 */
function start(userId) {
  sessions.set(userId, {
    step: 0,
    data: { keyword: '', type: 'general', limit: 10, format: 'json' },
    createdAt: Date.now(),
    timeout: setTimeout(() => expire(userId), TIMEOUT_MS),
  });
  log.info(`Wizard started: ${userId}`);
  return PROMPTS.keyword.ask;
}

/**
 * Process input for the current wizard step.
 * @param {string} userId
 * @param {string} input - User's text input
 * @returns {{ done: boolean, prompt: string, data: Object|null }}
 */
function processInput(userId, input) {
  const session = sessions.get(userId);
  if (!session) return { done: true, prompt: '', data: null };

  // Cancel keywords
  const cancelWords = ['cancel', 'batal', 'stop', 'quit', 'exit'];
  if (cancelWords.includes(input.trim().toLowerCase())) {
    destroy(userId);
    return { done: true, prompt: PROMPTS.cancelled, data: null };
  }

  const currentStep = STEPS[session.step];
  let validation;

  switch (currentStep) {
    case 'keyword':
      validation = validateKeyword(input);
      if (!validation.valid) return { done: false, prompt: PROMPTS.keyword.invalid, data: null };
      session.data.keyword = validation.value;
      break;

    case 'type':
      validation = validateType(input);
      if (!validation.valid) return { done: false, prompt: PROMPTS.type.invalid, data: null };
      session.data.type = validation.value;
      break;

    case 'limit':
      validation = validateLimit(input);
      if (!validation.valid) return { done: false, prompt: PROMPTS.limit.invalid, data: null };
      session.data.limit = validation.value;
      break;

    case 'confirm':
      validation = validateConfirm(input);
      if (!validation.valid) return { done: false, prompt: PROMPTS.confirm.invalid, data: null };
      if (!validation.value) {
        destroy(userId);
        return { done: true, prompt: PROMPTS.cancelled, data: null };
      }
      // Confirmed — return data
      const data = { ...session.data };
      destroy(userId);
      return { done: true, prompt: '', data };
  }

  // Move to next step
  session.step++;
  resetTimeout(userId);

  const nextStep = STEPS[session.step];
  if (nextStep === 'confirm') {
    const typeEmoji = { images: '🖼️', papers: '📄', datasets: '📊', forums: '💬', books: '📚', general: '🔍' };
    const summary = [
      `📝 Keyword: *${session.data.keyword}*`,
      `📂 Type: ${typeEmoji[session.data.type]} ${session.data.type}`,
      `📋 Limit: ${session.data.limit}`,
    ].join('\n');
    return { done: false, prompt: PROMPTS.confirm.ask(summary), data: null };
  }

  return { done: false, prompt: PROMPTS[nextStep].ask, data: null };
}

/**
 * Check if a user has an active wizard session.
 * @param {string} userId
 * @returns {boolean}
 */
function isActive(userId) {
  return sessions.has(userId);
}

/**
 * Reset the timeout for a session.
 * @param {string} userId
 */
function resetTimeout(userId) {
  const session = sessions.get(userId);
  if (session) {
    clearTimeout(session.timeout);
    session.timeout = setTimeout(() => expire(userId), TIMEOUT_MS);
  }
}

/**
 * Expire (timeout) a wizard session.
 * @param {string} userId
 */
function expire(userId) {
  if (sessions.has(userId)) {
    sessions.delete(userId);
    log.info(`Wizard expired: ${userId}`);
  }
}

/**
 * Destroy a wizard session.
 * @param {string} userId
 */
function destroy(userId) {
  const session = sessions.get(userId);
  if (session) {
    clearTimeout(session.timeout);
    sessions.delete(userId);
    log.debug(`Wizard destroyed: ${userId}`);
  }
}

module.exports = { start, processInput, isActive, destroy };
