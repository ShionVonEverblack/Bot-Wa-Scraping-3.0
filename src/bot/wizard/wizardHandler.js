'use strict';

/**
 * @fileoverview Wizard handler — integrates wizard state machine with message handler.
 * @module bot/wizard/wizardHandler
 */

const wizard = require('./wizardStateMachine');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('bot:wizard');

/**
 * Check if a message should be routed to the wizard.
 * @param {string} userId
 * @returns {boolean}
 */
function shouldHandleWizard(userId) {
  return wizard.isActive(userId);
}

/**
 * Handle wizard input from a user message.
 * @param {Object} msg - WhatsApp message
 * @param {Object} client - WhatsApp client
 * @param {string} userId - User ID
 * @param {string} text - Message text
 * @returns {Promise<boolean>} true if wizard handled the message
 */
async function handleWizardInput(msg, client, userId, text) {
  if (!wizard.isActive(userId)) return false;

  const result = wizard.processInput(userId, text);

  if (result.prompt) {
    await msg.reply(result.prompt);
  }

  if (result.done && result.data) {
    // Execute the wizard result as a scrape job
    try {
      const jobManager = require('../../jobs/jobManager');
      const chat = await msg.getChat();

      const job = await jobManager.createJob({
        request: {
          type: 'SCRAPE',
          keyword: result.data.keyword,
          scrapeType: result.data.type,
          limit: result.data.limit,
          format: result.data.format,
          chatId: chat.id._serialized,
          userId,
        },
        client,
      });

      const typeEmoji = { images: '🖼️', papers: '📄', datasets: '📊', general: '🔍' };
      await msg.reply(
        `${typeEmoji[result.data.type] || '🔍'} *Pencarian dimulai!*\n` +
        `🆔 Job: \`${job.jobId}\`\n` +
        `Tunggu sebentar...`
      );
    } catch (err) {
      log.error('Wizard job creation failed', { error: err.message });
      await msg.reply(`❌ Gagal: ${err.message}`);
    }
  }

  return true;
}

/**
 * Start a new wizard session.
 * @param {Object} msg - WhatsApp message
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function startWizard(msg, userId) {
  const prompt = wizard.start(userId);
  await msg.reply(prompt);
}

module.exports = { shouldHandleWizard, handleWizardInput, startWizard };
