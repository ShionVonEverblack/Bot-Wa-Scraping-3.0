'use strict';

/**
 * @fileoverview OCR command — Extract text from images using Vision AI.
 * Command: !ocr or !baca or !ekstrak (reply to an image)
 * @module commands/handlers/ocr.handler
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:ocr');

/**
 * Handle !ocr command.
 * @param {Object} msg - WhatsApp message
 */
async function handle(msg) {
  // Strict prompt to ensure AI only acts as a text extractor (OCR)
  const prompt = 'Ekstrak SELURUH TEKS yang ada di dalam gambar ini secara teliti, berurutan, dan presisi. Outputkan HANYA TEKS MURNI hasil ekstraksi tersebut, tanpa ada komentar tambahan, tanpa deskripsi, tanpa pembuka, dan tanpa kalimat penutup. Jika berupa tabel atau list, usahakan formatnya tetap rapi.';

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
    await msg.reply('📄 *Reply ke sebuah gambar* yang teksnya ingin diekstrak, lalu ketik `!ocr`\n\nAtau kirim langsung gambar dengan caption `!ocr`');
    return;
  }

  try {
    await msg.reply('👁️ Membaca teks pada gambar secara presisi...');

    const media = await mediaMsg.downloadMedia();
    if (!media || !media.data) {
      await msg.reply('❌ Gagal download gambar. Coba kirim ulang file tersebut.');
      return;
    }

    const aiService = require('../../services/ai/aiService');
    const extractedText = await aiService.analyzeImage({
      imageBase64: media.data,
      mimeType: media.mimetype || 'image/jpeg',
      prompt,
    });

    const formattedText = extractedText.trim().split('\n').map(line => `> ${line}`).join('\n');
    await msg.reply(`📄 *Hasil Ekstraksi OCR:*\n━━━━━━━━━━━━━━━━━━━━━━\n\n${formattedText}`);
  } catch (err) {
    log.error('OCR command failed', { error: err.message });
    await msg.reply(`❌ Gagal membaca teks: ${err.message}`);
  }
}

module.exports = { handle, command: 'ocr', description: 'Extract text from image (OCR) using Vision AI' };
