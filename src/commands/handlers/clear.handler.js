'use strict';

/**
 * @fileoverview Clear bot messages handler.
 * Command: !clear [timeframe]
 * @module commands/handlers/clear
 */

const { parseTime } = require('../../utils/time');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('commands:clear');

/**
 * Handle !clear command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client instance
 */
async function handle(msg, args, client) {
  // Default timeframe is 15 minutes if not specified
  const timeInput = args.length > 0 ? args[0] : '15m';
  
  const ms = parseTime(timeInput);
  if (!ms) {
    await msg.reply('❌ Format waktu tidak valid. Gunakan format seperti: 15m (15 menit), 1h (1 jam), 1d (1 hari), 2d12h (maksimal 2 hari 12 jam).');
    return;
  }

  // WhatsApp's 'delete for everyone' max limit is ~2 days 12 hours (60 hours)
  const MAX_TIME = 60 * 60 * 60 * 1000; // 60 hours in ms

  if (ms > MAX_TIME) {
    await msg.reply('⚠️ Kebijakan WhatsApp hanya mengizinkan "Hapus Untuk Semua Orang" untuk pesan yang berusia maksimal 2 hari 12 jam (60 jam).');
    return;
  }

  // Reply first so it shows progress, we'll delete it later or keep it.
  const loadingMsg = await msg.reply(`⏳ Sedang mencari dan menghapus pesan bot dalam rentang waktu ${timeInput}...`);

  try {
    const chat = await msg.getChat();
    // Fetch a large amount of messages if timeframe is large.
    // 1000 messages is usually enough for a chat within a week unless it's extremely active.
    const searchLimit = ms > 24 * 60 * 60 * 1000 ? 5000 : 1000;
    
    // fetchMessages supports limit. We don't filter by fromMe here because the API might not support it accurately, we filter manually.
    const messages = await chat.fetchMessages({ limit: searchLimit });
    
    const now = Date.now();
    const cutoffTime = now - ms;

    let deletedCount = 0;

    for (const message of messages) {
      // whatsapp-web.js timestamp is in seconds, so multiply by 1000
      const msgTimeMs = message.timestamp * 1000;
      
      // Check if message is from the bot, within the timeframe, and is not the loading message itself
      if (message.fromMe && msgTimeMs >= cutoffTime && message.id._serialized !== loadingMsg.id._serialized) {
        try {
          await message.delete(true); // true = delete for everyone
          deletedCount++;
        } catch (delErr) {
          log.warn(`Failed to delete message ${message.id._serialized}`, { error: delErr.message });
        }
      }
    }

    await loadingMsg.edit(`✅ Selesai! Berhasil menghapus ${deletedCount} pesan bot dalam rentang ${timeInput} terakhir.`);
    log.info(`Deleted ${deletedCount} messages in chat ${chat.id._serialized} for timeframe ${timeInput}`);

  } catch (err) {
    log.error('Clear messages error', { error: err.message });
    await loadingMsg.edit('❌ Terjadi kesalahan saat mencoba menghapus pesan.');
  }
}

module.exports = {
  handle,
  command: 'clear',
  aliases: ['hapus', 'bersihkan'],
  description: 'Menghapus pesan dari bot dalam rentang waktu tertentu (15m, 1h, 1d, 2d12h)',
};
