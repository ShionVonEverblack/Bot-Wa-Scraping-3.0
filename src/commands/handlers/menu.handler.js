'use strict';

/**
 * @fileoverview Menu handler (!menu) - Displays interactive UI list.
 * Falls back to rich text menu if List messages are not supported.
 * @module commands/handlers/menu.handler
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:menu');

/**
 * Build the fallback text menu (always works on all WA versions).
 * @returns {string}
 */
function buildTextMenu() {
  return (
    '🤖 *RIMA BOT v3.0 — DASHBOARD*\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📄 *Pencarian & Scraping*\n' +
    '  • `cari jurnal [topik]`\n' +
    '  • `cari gambar [keyword]`\n' +
    '  • `cari dataset [topik]`\n' +
    '  • `cari jurnal [topik] --multi`\n\n' +
    '📥 *Download & Analisa*\n' +
    '  • `!paper [DOI / arXiv ID]`\n' +
    '  • `!deepscrape [URL]`\n' +
    '  • `!customscrape [URL] --selector "[css]"`\n' +
    '  • `!analyze` _(reply ke gambar)_\n\n' +
    '🧠 *AI & Dokumen*\n' +
    '  • `!ai [pertanyaan]`\n' +
    '  • Kirim *Voice Note* → otomatis diproses\n' +
    '  • Download paper → lalu tanya isi dokumennya\n\n' +
    '⚙️ *Utilitas*\n' +
    '  • `!wizard` — Panduan langkah demi langkah\n' +
    '  • `!watch [keyword] --every daily`\n' +
    '  • `!history` — Riwayat pencarian\n' +
    '  • `!health` — Cek status sistem\n\n' +
    '🛡️ *Admin Only*\n' +
    '  • `!admin stats` — Statistik sistem\n' +
    '  • `!admin flush` — Bersihkan cache\n' +
    '  • `!admin cancel-all` — Hentikan semua job\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '_Ketik perintah di atas atau kirim pesan suara!_'
  );
}

/**
 * Handle !menu command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  try {
    // WhatsApp Multi-Device has completely deprecated List messages for non-business accounts,
    // causing silent crashes or disconnects in whatsapp-web.js.
    // We bypass the List UI and directly send the rich text menu.
    await msg.reply(buildTextMenu());
    log.debug('Text Menu sent successfully.');
  } catch (err) {
    log.error('Failed to send menu', { error: err.message });
  }
}

module.exports = { handle };
