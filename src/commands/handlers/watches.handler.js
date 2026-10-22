'use strict';

/**
 * @fileoverview Watches command — list active watches.
 * Command: !watches
 * @module commands/handlers/watches
 */

const { createLogger } = require('../../services/monitor/logger');
const log = createLogger('cmd:watches');

async function handle(msg) {
  try {
    const contact = await msg.getContact();
    const watchService = require('../../services/watch');
    const watches = await watchService.listWatches(contact.id._serialized);

    if (watches.length === 0) {
      await msg.reply('⏰ Belum ada watch aktif.\nBuat dengan: `!watch <keyword> --every daily`');
      return;
    }

    let response = '⏰ *Active Watches:*\n\n';
    watches.forEach((w, i) => {
      const status = w.active ? '✅' : '⏸️';
      response += `${i + 1}. ${status} \`${w.watchId}\`\n`;
      response += `   📝 ${w.keyword} (${w.type})\n`;
      response += `   🔄 ${w.scheduleRaw || w.schedule}\n`;
      if (w.lastRun) response += `   📅 Last: ${new Date(w.lastRun).toLocaleString()}\n`;
      response += '\n';
    });

    response += '💡 Hapus: `!unwatch <watchId>`';
    await msg.reply(response);
  } catch (err) {
    log.error('Watches command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'watches', description: 'List active watches' };
