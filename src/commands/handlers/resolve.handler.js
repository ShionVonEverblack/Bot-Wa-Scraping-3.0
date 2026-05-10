'use strict';

/**
 * @fileoverview Resolve command — resolve DOI/arXiv/PMID to paper metadata.
 * Command: !resolve <identifier>
 * @module commands/handlers/resolve
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:resolve');

/**
 * Handle !resolve command.
 * @param {Object} msg
 * @param {string[]} args
 */
async function handle(msg, args) {
  const identifier = args.join(' ').trim();

  if (!identifier) {
    await msg.reply('❓ *Gunakan:* `!resolve <DOI/arXiv/PMID>`\nContoh: `!resolve 10.1038/s41586-020-2649-2`');
    return;
  }

  try {
    await msg.reply('🔍 Resolving identifier...');

    const { parseIdentifier, resolvePdf } = require('../../jobs/paperWorker');
    const parsed = parseIdentifier(identifier);

    const resolved = await resolvePdf(parsed);

    let response = `📄 *Resolved: ${parsed.type.toUpperCase()}*\n\n`;
    response += `🔑 Identifier: \`${parsed.value}\`\n`;

    if (resolved.metadata?.title) response += `📝 Title: *${resolved.metadata.title}*\n`;
    if (resolved.metadata?.authors) response += `👤 Authors: ${resolved.metadata.authors}\n`;
    if (resolved.metadata?.year) response += `📅 Year: ${resolved.metadata.year}\n`;
    if (resolved.pdfUrl) response += `📥 PDF: ${resolved.pdfUrl}\n`;
    response += `🔧 Source: ${resolved.source}\n`;

    if (!resolved.pdfUrl) {
      response += '\n⚠️ PDF open-access tidak ditemukan.';
    } else {
      response += '\n💡 Ketik `!paper ' + identifier + '` untuk download.';
    }

    await msg.reply(response);
  } catch (err) {
    log.error('Resolve command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'resolve', description: 'Resolve paper identifier to metadata' };
