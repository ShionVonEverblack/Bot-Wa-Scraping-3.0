'use strict';

/**
 * @fileoverview Health check command handler.
 * Command: !health
 * @module commands/handlers/health
 */

const config = require('../../config');
const { formatDuration } = require('../../utils/time');

const startTime = Date.now();

/**
 * Handle !health command.
 * @param {Object} msg - WhatsApp message
 */
async function handle(msg) {
  const uptime = formatDuration(Date.now() - startTime);
  const memUsage = process.memoryUsage();
  const memMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1);

  // Check provider availability
  let providerStats = { total: 0, available: 0 };
  try {
    const registry = require('../../engine/providers');
    providerStats = registry.validate();
  } catch { /* ignore */ }

  // Check AI provider
  let aiStatus = '❌ Not configured';
  if (config.ai.openai.apiKey) aiStatus = '✅ OpenAI';
  else if (config.ai.gemini.apiKey) aiStatus = '✅ Gemini';
  else if (config.ai.groq.apiKey) aiStatus = '✅ Groq';
  else if (config.ai.grok.apiKey) aiStatus = '✅ Grok';

  // Queue stats
  let queueStats = { running: 0, queued: 0 };
  try {
    const jobQueue = require('../../jobs/jobQueue');
    queueStats = jobQueue.getStats();
  } catch { /* ignore */ }

  // Context memory stats
  let contextSize = 0;
  try {
    const contextMemory = require('../../bot/nlp/contextMemory');
    contextSize = contextMemory.size();
  } catch { /* ignore */ }

  const response = [
    `🏥 *${config.botName} — Health Check*\n`,
    `✅ *Status:* Online`,
    `⏱️ *Uptime:* ${uptime}`,
    `💾 *Memory:* ${memMB} MB`,
    `🖥️ *Node:* ${process.version}`,
    `🌍 *Env:* ${config.nodeEnv}`,
    '',
    `🔌 *Providers:* ${providerStats.available}/${providerStats.total} active`,
    `🤖 *AI:* ${aiStatus}`,
    `📊 *Queue:* ${queueStats.running} running, ${queueStats.queued} waiting`,
    `🧠 *Context:* ${contextSize} active sessions`,
  ].join('\n');

  await msg.reply(response);
}

module.exports = { handle, command: 'health', description: 'Show bot health status' };
