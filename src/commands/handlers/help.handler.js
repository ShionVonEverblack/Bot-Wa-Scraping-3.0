'use strict';

/**
 * @fileoverview Help command handler — shows all available commands.
 * @module commands/handlers/help
 */

const config = require('../../config');

/**
 * Handle !help command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args) {
  const topic = (args[0] || '').toLowerCase();

  if (topic) {
    const detail = getTopicHelp(topic);
    if (detail) {
      await msg.reply(detail);
      return;
    }
  }

  const helpText = [
    `🤖 *${config.botName} — Bantuan*\n`,
    '📋 *COMMAND UTAMA:*',
    '`!scrape <keyword>` — Cari data (gambar/paper/dataset/web)',
    '  └ `--type images|papers|datasets|general`',
    '  └ `--format json|csv|excel|txt|html`',
    '  └ `--limit N` (default: 10, max: 50)',
    '',
    '`!paper <DOI/arXiv/PMID>` — Download paper PDF',
    '`!deepscrape <url>` — Deep scrape halaman web',
    '`!template list|use|save` — Kelola template scrape',
    '',
    '📊 *JOB MANAGEMENT:*',
    '`!status <jobId>` — Cek status job',
    '`!cancel <jobId>` — Batalkan job',
    '`!history` — Lihat riwayat job',
    '`!next <jobId>` — Halaman berikutnya',
    '',
    '🤖 *AI:*',
    '`!ai <pertanyaan>` — Tanya AI',
    '`!analyze` — Analisa gambar (reply ke gambar)',
    '',
    '⚙️ *LAINNYA:*',
    '`!menu` — Menu interaktif',
    '`!health` — Status bot',
    '`!clear <waktu>` — Hapus chat bot (15m, 1h, 1d, 2d12h)',
    '`!help <topic>` — Bantuan detail',
    '',
    '💡 *Atau langsung bilang:*',
    '• "cari gambar kucing"',
    '• "cari paper machine learning"',
    '• "apa itu neural network?"',
    '• "download 10.1234/abcd"',
  ].join('\n');

  await msg.reply(helpText);
}

/**
 * Get detailed help for a specific topic.
 * @param {string} topic
 * @returns {string|null}
 */
function getTopicHelp(topic) {
  const topics = {
    scrape: [
      '🔍 *!scrape — Pencarian Data*\n',
      '*Penggunaan:*',
      '`!scrape <keyword> [options]`\n',
      '*Options:*',
      '`--type <type>` — Jenis data:',
      '  • `images` / `gambar` — Gambar',
      '  • `papers` / `paper` — Paper akademik',
      '  • `datasets` / `data` — Dataset',
      '  • `general` — Web umum (default)',
      '',
      '`--format <fmt>` — Format output:',
      '  • `json` (default), `csv`, `excel`, `txt`, `html`',
      '',
      '`--limit <N>` — Jumlah hasil (1-50, default: 10)',
      '`--provider <id>` — Provider spesifik',
      '',
      '*Contoh:*',
      '`!scrape machine learning --type papers --limit 20`',
      '`!scrape kucing lucu --type images --format csv`',
    ].join('\n'),

    paper: [
      '📄 *!paper — Download Paper*\n',
      '*Penggunaan:*',
      '`!paper <identifier>`\n',
      '*Identifier yang didukung:*',
      '• DOI: `10.1038/s41586-020-2649-2`',
      '• arXiv: `2301.07041`',
      '• PMID: `PMID:12345678`',
      '• URL langsung ke paper',
      '',
      '*Catatan:* Hanya paper open-access.',
    ].join('\n'),

    ai: [
      '🤖 *!ai — Tanya AI*\n',
      '*Penggunaan:*',
      '`!ai <pertanyaan>`\n',
      '*Contoh:*',
      '`!ai apa itu machine learning?`',
      '`!ai jelaskan neural network`',
      '`!ai translate "hello world" ke bahasa Jepang`',
    ].join('\n'),

    deepscrape: [
      '🔍 *!deepscrape — Deep Scrape URL*\n',
      '*Penggunaan:*',
      '`!deepscrape <url> [options]`\n',
      '*Options:*',
      '`--extract all|text|images|links|tables`',
      '`--format json|csv|excel`',
      '',
      '*Contoh:*',
      '`!deepscrape https://example.com --extract text`',
    ].join('\n'),
  };

  return topics[topic] || null;
}

module.exports = { handle, command: 'help', description: 'Show help information' };
