'use strict';

/**
 * @fileoverview Graph command handler — Graphify Knowledge Graph builder.
 * Command: !graph <jobId|url|keyword>
 * @module commands/handlers/graph
 */

const knowledgeGraph = require('../../services/graph/knowledgeGraph');
const jobStore = require('../../jobs/jobStore');
const contextMemory = require('../../bot/nlp/contextMemory');
const { scrapeUrlToMarkdown } = require('../../engine/llmCrawler');
const scrapeEngine = require('../../engine/scrapeEngine');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:graph');

/**
 * Handle !graph command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  let input = args.join(' ').trim();

  if (!input && typeof msg.getContact === 'function') {
    try {
      const contact = await msg.getContact();
      const userId = contact?.id?._serialized;
      const ctx = userId ? contextMemory.get(userId) : null;
      if (ctx?.lastJobId) {
        input = ctx.lastJobId;
      }
    } catch { /* ignore */ }
  }

  if (!input) {
    await msg.reply(
      [
        '🕸️ *!graph — Graphify Knowledge Graph Builder*',
        '',
        '*Penggunaan:*',
        '• `!graph <jobId>` — Buat Knowledge Graph dari hasil job scrape',
        '• `!graph <url>` — Buat Knowledge Graph dari halaman web',
        '• `!graph <teks panjang>` — Buat Knowledge Graph langsung dari teks',
        '• `!graph <keyword>` — Scrape & bangun Knowledge Graph otomatis',
      ].join('\n')
    );
    return;
  }

  try {
    let graph;

    if (/^J[a-zA-Z0-9]{5}$/.test(input)) {
      const job = await jobStore.getJob(input);
      if (!job || !job.result?.items?.length) {
        await msg.reply(`❌ Job \`${input}\` tidak ditemukan atau belum memiliki data.`);
        return;
      }
      graph = knowledgeGraph.buildGraphFromItems(job.result.items, {
        topic: job.request?.keyword || input,
      });
    } else if (/^https?:\/\//i.test(input)) {
      await msg.reply('🕸️ Mengekstrak entitas & relasi dari URL...');
      const doc = await scrapeUrlToMarkdown(input);
      graph = knowledgeGraph.buildGraphFromText(doc.fitMarkdown || doc.markdown, {
        title: doc.title || input,
      });
    } else if (input.length > 80 || input.includes('\n')) {
      graph = knowledgeGraph.buildGraphFromText(input, {
        title: input.slice(0, 40),
      });
    } else {
      await msg.reply(`🕸️ Mencari data & membangun Knowledge Graph untuk *"${input}"*...`);
      const res = await scrapeEngine.scrape({ type: 'papers', keyword: input, limit: 8 });
      graph = knowledgeGraph.buildGraphFromItems(res.items || [], { topic: input });
    }

    const report = knowledgeGraph.toMarkdownReport(graph);
    await msg.reply(report);
  } catch (err) {
    log.error('Graph command failed', { error: err.message });
    await msg.reply(`❌ Gagal membuat Knowledge Graph: ${err.message}`);
  }
}

module.exports = { handle, command: 'graph', description: 'Build a Graphify Knowledge Graph and Mermaid diagram' };
