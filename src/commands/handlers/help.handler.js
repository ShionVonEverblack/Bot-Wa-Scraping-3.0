'use strict';

/**
 * @fileoverview Help command handler — shows all available commands in a clean, mobile-friendly format.
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
    `🤖 *Bantuan & Panduan ${config.botName}*`,
    `-------------------------`,
    '💡 *Tip Cepat:* Ketik `!menu` untuk menampilkan *Tombol Interaktif* tanpa perlu menghafal perintah!\n',
    '🔍 *PENCARIAN & WEB SCRAPING (28 Provider)*',
    '`!scrape <keyword>` — Cari data multi-kategori',
    '  ├ `--type images|papers|datasets|code|books|forums|general`',
    '  ├ `--format json|csv|excel|txt|html`',
    '  └ `--limit N` (default: 10, max: 50)',
    '`!crawl <url>` — Ekstrak halaman web ke Markdown bersih',
    '`!deepscrape <url>` — Ekstrak struktur detail (tabel, link, heading)\n',
    '📄 *RISET PAPER, PDF & RAG*',
    '`!paper <DOI/arXiv/PMID>` — Download PDF paper ilmiah Open-Access',
    '`!rag <ingest|ask|stats|clear>` — Tanya jawab mendalam isi dokumen',
    '`!graph <jobId|url|keyword>` — Bangun Knowledge Graph & diagram\n',
    '🤫 *KONTROL ANTI-NIMBRUNG & MODE CHAT*',
    '`!pause [durasi]` — Heningkan bot (contoh: `!pause` atau `!pause 30m`)',
    '`!mode command` — Bot *hanya* aktif jika diawali tanda `!`',
    '`!resume` — Aktifkan bot kembali ke mode normal (`auto`)\n',
    '🧠 *AI, MEMORI & TOOLS*',
    '`!ai <pertanyaan>` — Tanya asisten AI',
    '`!analyze` — Analisa gambar (reply ke gambar)',
    '`!memory <remember|search|compress|clear>` — Kelola memori jangka panjang',
    '`!workflow <list|run>` | `!skills <list|use>` — Pipeline & keahlian khusus\n',
    '📊 *JOB & SISTEM*',
    '`!status <jobId>` | `!cancel <jobId>` | `!history`',
    '`!clear <waktu>` — Bersihkan pesan bot (15m, 1h, 1d)',
    '`!health` — Cek kesehatan sistem & provider',
    '`!help <topik>` — Detail per topik (`scrape`, `paper`, `pause`, `ai`, `deepscrape`)\n',
    '💬 *Atau langsung kirim tanpa perintah:*',
    '• Kirim *Link URL* artikel/YouTube → Otomatis dirangkum!',
    '• Kirim *Voice Note* → Otomatis ditranskrip & dijawab!',
    '• Ketik *"cari paper deep learning"* atau *"cari repo react"*',
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
      '🔍 *!scrape — Pencarian Data (28 Provider)*\n',
      '*Penggunaan:*',
      '`!scrape <keyword> [options]`\n',
      '*Options:*',
      '`--type <type>` — Kategori pencarian:',
      '  • `images` / `gambar` — Gambar (Unsplash, Pexels, Pixabay, dll.)',
      '  • `papers` / `paper` — Jurnal ilmiah (arXiv, PubMed, DBLP, OpenAlex, dll.)',
      '  • `datasets` / `data` — Dataset (Kaggle, HuggingFace, Zenodo, Data.gov)',
      '  • `code` / `kode` — Repositori & riset kode (GitHub, PapersWithCode)',
      '  • `books` / `buku` — Buku & literatur (Open Library, Project Gutenberg)',
      '  • `forums` / `forum` — Diskusi teknis (Hacker News, StackOverflow, Reddit)',
      '  • `general` — Web & ensiklopedia umum (Wikipedia, Wikidata, Archive.org)',
      '',
      '`--format <fmt>` — Format file ekspor:',
      '  • `json` (default), `csv`, `excel`, `txt`, `html`',
      '',
      '`--limit <N>` — Jumlah hasil (1-50, default: 10)',
      '`--provider <id>` — Pilih provider spesifik',
      '`--ai` — Sertakan ringkasan eksekutif AI',
      '',
      '*Contoh:*',
      '`!scrape transformer --type papers --ai`',
      '`!scrape llm agent --type code --format excel`',
    ].join('\n'),

    paper: [
      '📄 *!paper — Download Paper Ilmiah*\n',
      '*Penggunaan:*',
      '`!paper <identifier>`\n',
      '*Identifier yang didukung:*',
      '• DOI: `10.1038/s41586-020-2649-2`',
      '• arXiv: `2301.07041`',
      '• PMID / PMC: `PMID:12345678` atau `PMC1234567`',
      '• URL langsung ke paper',
      '',
      '*Resolver Otomatis:* arXiv → Unpaywall → OpenAlex → PubMed/EuropePMC → Crossref.',
    ].join('\n'),

    pause: [
      '🤫 *!pause, !resume & !mode — Kontrol Anti-Nimbrung*\n',
      '*Perintah:*',
      '• `!pause` — Heningkan bot sepenuhnya di chat ini hingga `!resume` diketik',
      '• `!pause 30m` — Heningkan bot selama 30 menit (mendukung `15m`, `2h`, `1d`)',
      '• `!mode command` — Bot *hanya* merespons jika pesan diawali tanda `!` (tidak ikut nimbrung chat biasa/link)',
      '• `!mode auto` / `!resume` — Kembalikan bot ke mode aktif normal',
      '• `!mode` — Lihat status mode ruang obrolan saat ini',
    ].join('\n'),

    mode: [
      '⚙️ *!mode — Pengaturan Mode Interaksi Chat*\n',
      '• `!mode` — Cek status mode saat ini',
      '• `!mode command` — Mode Command-Only (hanya merespons awalan `!`)',
      '• `!mode auto` — Mode Pintar Penuh (merespons `!`, link, dan bahasa alami)',
      '• `!mode pause` — Heningkan bot sepenuhnya hingga `!resume`',
    ].join('\n'),

    ai: [
      '🤖 *!ai — Tanya AI*\n',
      '*Penggunaan:*',
      '`!ai <pertanyaan>`\n',
      '*Contoh:*',
      '`!ai apa itu machine learning?`',
      '`!ai jelaskan perbedaan RAG dan fine-tuning`',
      '`!ai translate "hello world" ke bahasa Jepang`',
    ].join('\n'),

    deepscrape: [
      '🔍 *!deepscrape — Deep Scrape URL*\n',
      '*Penggunaan:*',
      '`!deepscrape <url> [options]`\n',
      '*Options:*',
      '`--extract all|text|images|links|tables`',
      '`--format json|csv|excel|txt|html`',
      '',
      '*Contoh:*',
      '`!deepscrape https://example.com --extract text --format excel`',
    ].join('\n'),
  };

  return topics[topic] || null;
}

module.exports = { handle, command: 'help', description: 'Show help information' };
