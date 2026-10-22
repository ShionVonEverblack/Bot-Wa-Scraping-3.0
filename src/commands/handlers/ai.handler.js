'use strict';

/**
 * @fileoverview AI chat command handler.
 * Command: !ai <question>
 * @module commands/handlers/ai
 */

const { createLogger } = require('../../services/monitor/logger');
const { truncate } = require('../../utils/text');
const skillRegistry = require('../../services/skills/skillRegistry');
const persistentMemory = require('../../services/memory/persistentMemory');
const contextMemory = require('../../bot/nlp/contextMemory');
const { compressMessages } = require('../../services/compression/contextCompressor');

const log = createLogger('cmd:ai');

/**
 * Handle !ai command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const question = args.join(' ').trim();

  if (!question) {
    await msg.reply('❓ *Mau tanya apa?*\n\nContoh:\n`!ai apa itu machine learning?`\n`!ai jelaskan quantum computing`');
    return;
  }

  try {
    await msg.reply('🤔 Sedang berpikir...');

    let userId = null;
    if (typeof msg.getContact === 'function') {
      try {
        const contact = await msg.getContact();
        userId = contact?.id?._serialized || null;
      } catch { /* ignore */ }
    }

    const contextBlocks = [];
    if (userId) {
      const activeSkill = skillRegistry.getActiveSkill(userId);
      if (activeSkill) {
        contextBlocks.push(`### Active Agent Skill: ${activeSkill.name}\n${truncate(activeSkill.content, 1200)}`);
      }
      const memPrompt = persistentMemory.buildMemoryContextPrompt(userId, question, 3);
      if (memPrompt) {
        contextBlocks.push(memPrompt);
      }
      const ctx = contextMemory.get(userId);
      const history = ctx?.messages || [];
      if (history.length > 0) {
        const compressed = compressMessages(history, 800);
        const histLines = compressed.messages.map(m => `${m.role}: ${m.content}`).join('\n');
        contextBlocks.push(`### Recent Conversation\n${histLines}`);
      }
    }

    const enrichedPrompt = contextBlocks.length > 0
      ? `${contextBlocks.join('\n\n')}\n\n### User Question\n${question}`
      : question;

    const aiService = require('../../services/ai/aiService');
    const response = await aiService.chat(enrichedPrompt);

    if (userId) {
      contextMemory.store(userId, { message: { role: 'user', content: question } });
      contextMemory.store(userId, { message: { role: 'assistant', content: response } });
    }

    await msg.reply(`🤖 *${truncate(question, 50)}*\n\n${response}`);
  } catch (err) {
    log.error('AI command failed', { error: err.message });
    await msg.reply('❌ AI sedang tidak tersedia. Coba lagi nanti.');
  }
}

module.exports = { handle, command: 'ai', description: 'Ask AI a question' };
