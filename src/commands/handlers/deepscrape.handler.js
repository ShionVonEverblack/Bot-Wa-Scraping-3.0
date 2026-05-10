'use strict';

/**
 * @fileoverview Deep scrape command handler.
 * Command: !deepscrape <url> [--format json|csv|excel] [--extract all|text|images|links|tables]
 * @module commands/handlers/deepscrape
 */

const { deepScrape } = require('../../engine/deepScraper');
const { createLogger } = require('../../services/monitor/logger');
const yargsParser = require('yargs-parser');
const { normalizeFormat } = require('../../utils/validators');
const { truncate } = require('../../utils/text');

const log = createLogger('cmd:deepscrape');

/**
 * Handle the !deepscrape command.
 * @param {Object} msg - WhatsApp message object
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  const parsed = yargsParser(args);
  const url = parsed._[0];

  if (!url || !url.startsWith('http')) {
    await msg.reply('❌ Gunakan: `!deepscrape <url>` [--format json] [--extract all|text|images|links|tables]');
    return;
  }

  const format = normalizeFormat(parsed.format);
  const extract = parsed.extract || 'all';

  await msg.reply(`🔍 Deep scraping: ${truncate(url, 60)}...\nExtract: ${extract} | Format: ${format}`);

  try {
    const result = await deepScrape(url, { extract, waitFor: parsed.waitFor });

    // Build response text
    let response = `📊 *Deep Scrape Result*\n`;
    response += `🔗 ${result.url}\n`;
    response += `📝 *Title:* ${result.title || 'N/A'}\n`;
    if (result.description) response += `📋 *Description:* ${truncate(result.description, 200)}\n`;
    response += `\n`;

    if (result.headings?.length) response += `📌 *Headings:* ${result.headings.length}\n`;
    if (result.paragraphs?.length) response += `📄 *Paragraphs:* ${result.paragraphs.length}\n`;
    if (result.images?.length) response += `🖼️ *Images:* ${result.images.length}\n`;
    if (result.links?.length) response += `🔗 *Links:* ${result.links.length}\n`;
    if (result.tables?.length) response += `📊 *Tables:* ${result.tables.length}\n`;

    // Show first few items of each type
    if (result.headings?.length) {
      response += `\n*Top Headings:*\n`;
      result.headings.slice(0, 5).forEach(h => { response += `${'  '.repeat(h.level - 1)}• ${h.text}\n`; });
    }

    await msg.reply(response);
    log.info(`Deep scrape completed for ${url}`);
  } catch (err) {
    log.error('Deep scrape command failed', { url, error: err.message });
    await msg.reply(`❌ Deep scrape gagal: ${err.message}`);
  }
}

module.exports = { handle, command: 'deepscrape', description: 'Deep scrape a URL for structured data' };
