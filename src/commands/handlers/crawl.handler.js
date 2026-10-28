'use strict';

/**
 * @fileoverview Crawl command handler — LLM-ready Web Crawling & Adaptive Scraping.
 * Inspired by Firecrawl, Crawl4AI, Scrapling, and Agent-Reach.
 * Command: !crawl <url> [--depth N] [--max N] [--selector "<css>"] [--bridge native|jina|firecrawl]
 * @module commands/handlers/crawl
 */

const yargsParser = require('yargs-parser');
const { scrapeUrlToMarkdown, crawlSite } = require('../../engine/llmCrawler');
const { adaptiveExtract, getStealthHeaders } = require('../../engine/adaptiveScraper');
const httpClient = require('../../utils/httpClient');
const { truncate } = require('../../utils/text');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:crawl');

/**
 * Handle !crawl command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const parsed = yargsParser(args);
  const url = parsed._[0];

  if (!url || !/^https?:\/\//i.test(url)) {
    await msg.reply(
      [
        '🕷️ *!crawl — LLM-Ready Web Crawler & Adaptive Scraper*',
        '',
        '*Penggunaan:*',
        '• `!crawl <url>` — Ekstrak halaman ke Fit-Markdown (Firecrawl/Crawl4AI)',
        '• `!crawl <url> --max 3 --depth 1` — Multi-page BFS crawl',
        '• `!crawl <url> --selector ".price"` — Adaptive scraping (Scrapling self-healing)',
        '• `!crawl <url> --bridge jina|firecrawl|native` — Pilih bridge reader',
      ].join('\n')
    );
    return;
  }

  const positionalMax = parsed._[1] && /^\d+$/.test(String(parsed._[1])) ? parseInt(parsed._[1], 10) : null;
  const maxPages = parseInt(parsed.max || parsed.limit || positionalMax || '1', 10);
  const maxDepth = parseInt(parsed.depth || '1', 10);
  const selector = parsed.selector || parsed.s || null;
  const bridge = parsed.bridge || parsed.b || undefined;
  const preferFit = parsed.fit !== false;

  try {
    // 1. Adaptive Selector Mode (Scrapling)
    if (selector) {
      await msg.reply(`🎯 Adaptive scraping \`${selector}\` pada ${truncate(url, 60)}...`);
      const resp = await httpClient.get(url, { headers: getStealthHeaders(url), timeout: 25000 });
      const res = await adaptiveExtract(String(resp.data || ''), {
        selector,
        adaptiveKey: `${url}::${selector}`,
      });

      if (res.items.length === 0) {
        await msg.reply(`⚠️ Selector \`${selector}\` tidak ditemukan di halaman tujuan.`);
        return;
      }

      const preview = res.items.slice(0, 10).map((item, i) => `${i + 1}. ${truncate(item, 200)}`).join('\n');
      await msg.reply(
        [
          `✅ *Hasil Adaptive Scrape (${res.mode})*`,
          `🔎 Matched Selector: \`${res.matchedSelector}\` (Score: ${(res.similarityScore * 100).toFixed(0)}%)`,
          '',
          preview,
        ].join('\n')
      );
      return;
    }

    // 2. Multi-page BFS Crawl Mode (Firecrawl /crawl)
    if (maxPages > 1) {
      await msg.reply(`🕷️ Crawling situs ${truncate(url, 50)} (max: ${maxPages} halaman, depth: ${maxDepth})...`);
      const siteResult = await crawlSite(url, { maxPages, maxDepth, bridge });
      const pageList = siteResult.pages
        .map((p, i) => `${i + 1}. *${truncate(p.title || p.url, 50)}* (${p.wordCount} kata)\n   🔗 ${p.url}`)
        .join('\n');

      await msg.reply(
        [
          `🕷️ *Multi-Page Crawl Selesai (${siteResult.pagesVisited} halaman)*`,
          '',
          pageList,
          '',
          '📝 *Preview Fit-Markdown:*',
          truncate(siteResult.combinedMarkdown, 1200),
        ].join('\n')
      );
      if (siteResult.combinedMarkdown && siteResult.combinedMarkdown.length > 1000) {
        try {
          const fs = require('fs');
          const path = require('path');
          const config = require('../../config');
          const { MessageMedia } = require('whatsapp-web.js');
          const outDir = config.dirs?.outputs || './outputs';
          if (!fs.existsSync(outDir)) await fs.promises.mkdir(outDir, { recursive: true });
          const safeDomain = new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const mdPath = path.join(outDir, `crawl_multipage_${safeDomain}_${Date.now()}.md`);
          await fs.promises.writeFile(mdPath, siteResult.combinedMarkdown, 'utf8');

          const media = MessageMedia.fromFilePath(mdPath);
          const targetChat = msg.from || msg.to;
          if (msg.client && typeof msg.client.sendMessage === 'function') {
            await msg.client.sendMessage(targetChat, media, { caption: `📑 *Dokumen Multi-Page Crawl:* ${siteResult.pagesVisited} halaman` });
          } else if (typeof msg.reply === 'function') {
            await msg.reply(media, undefined, { caption: `📑 *Dokumen Multi-Page Crawl:* ${siteResult.pagesVisited} halaman` });
          }
        } catch (mediaErr) {
          log.debug('Could not auto-deliver multi-page markdown document', { error: mediaErr.message });
        }
      }
      return;
    }

    // 3. Single-page LLM-Ready Fit-Markdown Mode (Crawl4AI / Firecrawl / Agent-Reach)
    await msg.reply(`📄 Mengekstrak Fit-Markdown dari ${truncate(url, 60)}...`);
    const doc = await scrapeUrlToMarkdown(url, { bridge });
    const markdownBody = preferFit ? (doc.fitMarkdown || doc.markdown) : (doc.markdown || doc.fitMarkdown);

    // Store in contextMemory so user can ask follow-up questions about this page
    try {
      const contextMemory = require('../../bot/nlp/contextMemory');
      const contact = typeof msg.getContact === 'function' ? await msg.getContact() : null;
      const userId = contact?.id?._serialized || msg.author || msg.from;
      if (userId && markdownBody) {
        contextMemory.store(userId, {
          lastUrl: url,
          lastDocumentTitle: doc.title || url,
          lastDocumentText: markdownBody.slice(0, 4000),
        });
      }
    } catch { /* ignore context store error */ }

    await msg.reply(
      [
        `📄 *${doc.title || url}*`,
        `🔧 Bridge: \`${doc.bridgeUsed}\` | 📊 Kata: *${doc.wordCount}* (~${doc.readingTimeMinutes} mnt baca) | 🔗 Links: *${doc.links.length}*`,
        '━━━━━━━━━━━━━━━━━━━━━━',
        truncate(markdownBody, 1800),
      ].join('\n')
    );

    if (markdownBody && markdownBody.length > 1000) {
      try {
        const fs = require('fs');
        const path = require('path');
        const config = require('../../config');
        const { MessageMedia } = require('whatsapp-web.js');
        const outDir = config.dirs?.outputs || './outputs';
        if (!fs.existsSync(outDir)) await fs.promises.mkdir(outDir, { recursive: true });
        const safeDomain = new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const mdPath = path.join(outDir, `crawl_${safeDomain}_${Date.now()}.md`);
        await fs.promises.writeFile(mdPath, markdownBody, 'utf8');

        const media = MessageMedia.fromFilePath(mdPath);
        const targetChat = msg.from || msg.to;
        if (msg.client && typeof msg.client.sendMessage === 'function') {
          await msg.client.sendMessage(targetChat, media, { caption: `📑 *Dokumen Fit-Markdown Lengkap:* ${doc.title || safeDomain}` });
        } else if (typeof msg.reply === 'function') {
          await msg.reply(media, undefined, { caption: `📑 *Dokumen Fit-Markdown Lengkap:* ${doc.title || safeDomain}` });
        }
      } catch (mediaErr) {
        log.debug('Could not auto-deliver markdown document', { error: mediaErr.message });
      }
    }
  } catch (err) {
    log.error('Crawl command failed', { url, error: err.message });
    await msg.reply(`❌ Crawl gagal: ${err.message}`);
  }
}

module.exports = { handle, command: 'crawl', description: 'LLM-ready web crawler and adaptive scraper' };
