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
  // Try sending a WhatsApp List message first
  try {
    const { List } = require('whatsapp-web.js');

    const sections = [{
      title: 'Pencarian Data',
      rows: [
        { title: 'Cari Jurnal / Paper', id: 'menu_jurnal', description: 'Pencarian paper akademik' },
        { title: 'Cari Gambar', id: 'menu_gambar', description: 'Cari aset gambar dari berbagai sumber' },
        { title: 'Cari Dataset', id: 'menu_dataset', description: 'Cari dataset CSV dari Kaggle, Zenodo, dll' },
      ]
    }, {
      title: 'AI dan Utilitas',
      rows: [
        { title: 'Tanya AI', id: 'menu_ai', description: 'Chat langsung dengan AI' },
        { title: 'Admin Dashboard', id: 'menu_admin', description: 'Statistik dan kontrol sistem' },
      ]
    }];

    const list = new List(
      'Selamat datang di Rima Bot v3.0 Ultimate! Pilih fitur yang ingin Anda gunakan dari daftar di bawah ini.',
      'Pilih Fitur',
      sections,
      'RIMA DASHBOARD',
      'Rima AI Scraping Bot'
    );

    await msg.reply(list);
    log.debug('Interactive List Menu sent successfully.');
  } catch (err) {
    log.warn('List message not supported, sending text fallback', { error: err.message });
    await msg.reply(buildTextMenu());
  }
}

module.exports = { handle };
