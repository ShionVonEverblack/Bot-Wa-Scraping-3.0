'use strict';

/**
 * @fileoverview Analyze/Analisa command — AI vision analysis on images.
 * Command: !analyze or !analisa (reply to an image)
 * @module commands/handlers/analyze
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:analyze');

/**
 * Handle !analyze / !analisa command.
 * @param {Object} msg - WhatsApp message
 */
async function handle(msg, args) {
  const prompt = args.join(' ').trim() || 'Analisa gambar ini secara detail dalam bahasa Indonesia.';

  // Check if replying to an image
  let mediaMsg = null;
  if (msg.hasMedia) {
    mediaMsg = msg;
  } else if (msg.hasQuotedMsg) {
    const quoted = await msg.getQuotedMessage();
    if (quoted && quoted.hasMedia) {
      mediaMsg = quoted;
    }
  }

  if (!mediaMsg) {
    await msg.reply('🖼️ *Reply ke gambar* yang ingin dianalisa, lalu ketik `!analyze`\n\nAtau kirim gambar dengan caption `!analyze`');
    return;
  }

  try {
    await msg.reply('🔍 Menganalisa gambar...');

    const media = await mediaMsg.downloadMedia();
    if (!media || !media.data) {
      await msg.reply('❌ Gagal download gambar. Coba kirim ulang.');
      return;
    }

    const aiService = require('../../services/ai/aiService');
    const analysis = await aiService.analyzeImage({
      imageBase64: media.data,
      mimeType: media.mimetype || 'image/jpeg',
      prompt,
    });

    await msg.reply(`🖼️ *Analisis Gambar AI:*\n━━━━━━━━━━━━━━━━━━━━━━\n\n${analysis.trim()}`);
  } catch (err) {
    log.error('Analyze command failed', { error: err.message });
    await msg.reply(`❌ Gagal menganalisa: ${err.message}`);
  }
}

module.exports = { handle, command: 'analyze', description: 'Analyze an image with AI' };
