'use strict';

/**
 * @fileoverview Workflow command handler — Dify-style agentic pipelines.
 * Command: !workflow <list|run> [workflowId] [query_or_url]
 * @module commands/handlers/workflow
 */

const workflowEngine = require('../../services/workflows/workflowEngine');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:workflow');

/**
 * Handle !workflow command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const sub = (args[0] || 'list').toLowerCase();

  if (sub === 'list' || !args[0]) {
    const workflows = workflowEngine.listWorkflows();
    const listStr = workflows
      .map(w => `• \`${w.id}\` — *${w.name}* (${w.nodeCount} nodes)\n  _${w.description}_`)
      .join('\n\n');

    await msg.reply(
      [
        '⚙️ *Dify Agentic Workflows*',
        '',
        listStr,
        '',
        '💡 *Jalankan:* `!workflow run deep-research <topik>` atau `!workflow run url-to-rag <url>`',
      ].join('\n')
    );
    return;
  }

  const workflowId = sub === 'run' ? args[1] : args[0];
  const query = (sub === 'run' ? args.slice(2) : args.slice(1)).join(' ').trim();

  if (!workflowId || !query) {
    await msg.reply('❓ Gunakan: `!workflow run <deep-research|url-to-rag|quick-digest> <topik_atau_url>`');
    return;
  }

  try {
    const contact = await msg.getContact();
    const userId = contact.id._serialized;

    await msg.reply(`⚙️ Menjalankan workflow \`${workflowId}\` untuk *"${query}"*...`);
    const result = await workflowEngine.runWorkflow(workflowId, {
      query,
      url: /^https?:\/\//i.test(query) ? query : undefined,
      userId,
    });

    await msg.reply(result.summaryReport);
  } catch (err) {
    log.error('Workflow execution failed', { error: err.message });
    await msg.reply(`❌ Workflow gagal: ${err.message}`);
  }
}

module.exports = { handle, command: 'workflow', description: 'Run Dify-style multi-step agentic workflows' };
