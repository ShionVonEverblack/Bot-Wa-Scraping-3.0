'use strict';

/**
 * @fileoverview Menu command handler — sends interactive WhatsApp Poll buttons or text menu fallback.
 * @module commands/handlers/menu
 */

const { Poll } = require('whatsapp-web.js');
const config = require('../../config');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:menu');

const MENU_OPTIONS = [
  '🔍 1. Cari Data (Scrape)',
  '🕸️ 2. Crawl Website (LLM)',
  '📄 3. Download Paper PDF',
  '🧠 4. Chat Dokumen (RAG)',
  '🤖 5. Tanya AI / Asisten',
  '📖 6. Panduan Lengkap Teks',
];

/**
 * Render fallback text menu when Poll is not used or not supported.
 * @returns {string}
 */
function getTextMenu() {
  return [
    `╔══════════════════════════════╗`,
    `║  🤖 *${config.botName || 'Rima'}* — Menu Utama   ║`,
    `╚══════════════════════════════╝\n`,
    `💡 *Pilih salah satu layanan dengan mengetik perintah:*`,
    `1️⃣ *Cari Data*: \`!scrape <keyword>\` (gambar, paper, dataset)`,
    `2️⃣ *Crawl Web*: \`!crawl <url>\` (ekstrak ke Markdown)`,
    `3️⃣ *Download Paper*: \`!paper <DOI/arXiv>\``,
    `4️⃣ *Chat Dokumen*: \`!rag ask <pertanyaan>\``,
    `5️⃣ *Tanya AI*: \`!ai <pertanyaan>\``,
    `6️⃣ *Panduan Lengkap*: \`!help\`\n`,
    `_Ketik \`!menu\` untuk tombol interaktif sekali klik._`,
  ].join('\n');
}

/**
 * Handle !menu command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} [client] - WhatsApp client instance
 */
async function handle(msg, args = [], client) {
  const mode = (args[0] || '').toLowerCase();

  // If user explicitly asks for text menu
  if (mode === 'text' || mode === 'teks') {
    await msg.reply(getTextMenu());
    return;
  }

  // Attempt to send WhatsApp Native Poll as interactive buttons
  const targetClient = client || msg.client;
  const chatId = msg.from || msg.to;

  if (targetClient && typeof targetClient.sendMessage === 'function' && chatId) {
    try {
      const pollTitle = `🤖 *Menu Utama ${config.botName || 'Rima'}*\nSilakan klik salah satu tombol layanan di bawah ini:`;
      const poll = new Poll(pollTitle, MENU_OPTIONS, {
        allowMultipleAnswers: false,
      });

      await targetClient.sendMessage(chatId, poll);
      log.info(`Sent interactive menu Poll to ${chatId}`);
      return;
    } catch (err) {
      log.warn(`Failed to send native Poll menu, falling back to text: ${err.message}`);
    }
  }

  // Fallback: send text menu
  await msg.reply(getTextMenu());
}

module.exports = {
  handle,
  getTextMenu,
  MENU_OPTIONS,
};
