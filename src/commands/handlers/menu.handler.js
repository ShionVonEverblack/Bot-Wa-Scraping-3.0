'use strict';

/**
 * @fileoverview Menu command handler — interactive menu for bot features.
 * @module commands/handlers/menu
 */

const config = require('../../config');

/**
 * Handle !menu command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const mode = (args[0] || '').toLowerCase();

  if (mode === 'short') {
    await msg.reply(getShortMenu());
    return;
  }

  if (mode === 'full') {
    await msg.reply(getFullMenu());
    return;
  }

  await msg.reply(getDefaultMenu());
}

/**
 * Default interactive menu.
 * @returns {string}
 */
function getDefaultMenu() {
  return [
    `🤖 *Rima — Menu Utama*`,
    `-------------------------`,
    'Pilih kategori di bawah ini atau langsung ngobrol dengan Rima!\n',
    '🔍 *1. Cari Data*',
    '   Ketik: `!scrape <keyword>`',
    '   Contoh: "cari gambar kucing"\n',
    '📄 *2. Download Paper*',
    '   Ketik: `!paper <DOI/arXiv>`\n',
    '🌐 *3. Deep Scrape*',
    '   Ketik: `!deepscrape <url>`\n',
    '🤖 *4. Tanya AI*',
    '   Ketik: `!ai <pertanyaan>`\n',
    '🖼️ *5. Analisa Gambar*',
    '   Kirim gambar + caption `!analyze`\n',
    '📊 *6. Manajemen Job*',
    '   Ketik: `!status <jobId>`\n',
    '🧹 *7. Bersihkan Chat*',
    '   Ketik: `!clear 15m`\n',
    '-------------------------',
    '`!menu full` — Menu lengkap',
    '`!help` — Daftar semua command',
  ].join('\n');
}

/**
 * Short menu (compact).
 * @returns {string}
 */
function getShortMenu() {
  return [
    `🤖 *Rima — Quick Menu*\n`,
    '🔍 `!scrape` — Cari data',
    '📄 `!paper` — Download paper',
    '🌐 `!deepscrape` — Deep scrape URL',
    '🤖 `!ai` — Tanya AI',
    '🖼️ `!analyze` — Analisa gambar',
    '🧹 `!clear` — Bersihkan chat bot',
    '❓ `!help` — Bantuan',
  ].join('\n');
}

/**
 * Full menu with detailed descriptions.
 * @returns {string}
 */
function getFullMenu() {
  return [
    `🤖 *Rima — Menu Lengkap*`,
    `-------------------------`,
    '\n🔍 *PENCARIAN DATA*',
    '`!scrape <keyword>` — Cari data',
    '  ├ `--type images` — Gambar',
    '  ├ `--type papers` — Paper',
    '  ├ `--type datasets` — Dataset',
    '  ├ `--type forums` — Diskusi/Reddit',
    '  ├ `--type books` — Buku',
    '  ├ `--type general` — Web',
    '  ├ `--format json|csv|excel|txt|html`',
    '  └ `--limit N` (1-50)\n',
    '📄 *PAPER & PDF*',
    '`!paper <DOI/arXiv/PMID>` — Download paper OA',
    '`!deepscrape <url>` — Deep scrape URL',
    '`!template list` — Lihat template scrape\n',
    '🤖 *AI*',
    '`!ai <pertanyaan>` — Tanya AI apa saja',
    '`!analyze` — Analisa gambar\n',
    '📊 *JOB & SISTEM*',
    '`!status <jobId>` — Status job',
    '`!cancel <jobId>` — Batalkan job',
    '`!history` — Riwayat job',
    '`!clear <waktu>` — Bersihkan chat (15m, 1h)',
    '`!health` — Status bot',
    '`!help` — Bantuan\n',
    '💡 *NATURAL LANGUAGE*',
    'Kamu bisa chat biasa seperti:',
    '• "carikan paper tentang AI"',
    '• "apa itu deep learning?"',
    '• "download paper 10.1234/abcd"',
  ].join('\n');
}

module.exports = { handle, command: 'menu', description: 'Show interactive menu' };
