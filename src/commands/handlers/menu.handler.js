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
    `╔══════════════════════════╗`,
    `║  🤖 *${config.botName}* — Menu Utama  ║`,
    `╚══════════════════════════╝\n`,
    '🔍 *1. Cari Data*',
    '   Ketik: `!scrape <keyword>`',
    '   Atau langsung: "cari gambar kucing"\n',
    '📄 *2. Download Paper*',
    '   Ketik: `!paper <DOI/arXiv>`',
    '   Atau kirim DOI langsung\n',
    '🌐 *3. Deep Scrape*',
    '   Ketik: `!deepscrape <url>`\n',
    '📋 *4. Template Scrape*',
    '   Ketik: `!template list`\n',
    '🤖 *5. Tanya AI*',
    '   Ketik: `!ai <pertanyaan>`',
    '   Atau langsung tanya apa saja\n',
    '🖼️ *6. Analisa Gambar*',
    '   Reply gambar + ketik `!analyze`\n',
    '📊 *7. Cek Status Job*',
    '   Ketik: `!status <jobId>`\n',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '`!menu short` — Menu singkat',
    '`!menu full` — Menu lengkap',
    '`!help` — Daftar semua command',
    '`!health` — Status bot',
  ].join('\n');
}

/**
 * Short menu (compact).
 * @returns {string}
 */
function getShortMenu() {
  return [
    `🤖 *${config.botName} — Quick Menu*\n`,
    '🔍 `!scrape` — Cari data',
    '📄 `!paper` — Download paper',
    '🌐 `!deepscrape` — Deep scrape URL',
    '🤖 `!ai` — Tanya AI',
    '🖼️ `!analyze` — Analisa gambar',
    '📊 `!status` — Cek job',
    '❌ `!cancel` — Batalkan job',
    '📋 `!history` — Riwayat',
    '❓ `!help` — Bantuan',
  ].join('\n');
}

/**
 * Full menu with detailed descriptions.
 * @returns {string}
 */
function getFullMenu() {
  return [
    `╔══════════════════════════════╗`,
    `║  🤖 *${config.botName}* — Menu Lengkap  ║`,
    `╚══════════════════════════════╝\n`,
    '━━━ 🔍 *PENCARIAN DATA* ━━━',
    '`!scrape <keyword>` — Cari data',
    '  ├ `--type images` — Gambar (Unsplash, Pexels, Pixabay)',
    '  ├ `--type papers` — Paper (OpenAlex, arXiv, Crossref)',
    '  ├ `--type datasets` — Dataset (Kaggle, HuggingFace)',
    '  ├ `--type general` — Web (DuckDuckGo, Wikipedia)',
    '  ├ `--format json|csv|excel|txt|html`',
    '  └ `--limit N` (1-50)\n',
    '━━━ 📄 *PAPER & PDF* ━━━',
    '`!paper <DOI/arXiv/PMID>` — Download paper open-access',
    '`!deepscrape <url>` — Deep scrape halaman web',
    '`!template list` — Lihat template scrape',
    '`!template use <name> <url>` — Gunakan template\n',
    '━━━ 🤖 *AI* ━━━',
    '`!ai <pertanyaan>` — Tanya AI apa saja',
    '`!analyze` — Analisa gambar (reply ke gambar)\n',
    '━━━ 📊 *JOB MANAGEMENT* ━━━',
    '`!status <jobId>` — Status job',
    '`!cancel <jobId>` — Batalkan job',
    '`!next <jobId>` — Halaman berikutnya',
    '`!history` — Riwayat job\n',
    '━━━ ⚙️ *SISTEM* ━━━',
    '`!health` — Status dan info bot',
    '`!help` — Bantuan',
    '`!menu short|full` — Menu\n',
    '━━━ 💡 *NATURAL LANGUAGE* ━━━',
    'Kamu juga bisa bicara langsung:',
    '• "cari gambar pemandangan"',
    '• "carikan paper tentang AI"',
    '• "apa itu deep learning?"',
    '• "download paper 10.1234/abcd"',
  ].join('\n');
}

module.exports = { handle, command: 'menu', description: 'Show interactive menu' };
