'use strict';

/**
 * @fileoverview Template command handler.
 * Commands: !template list | !template use <name> <url> | !template save <name>
 * @module commands/handlers/template
 */

const templateStore = require('../../services/scrapeTemplates/templateStore');
const { deepScrape } = require('../../engine/deepScraper');
const { createLogger } = require('../../services/monitor/logger');
const { truncate } = require('../../utils/text');

const log = createLogger('cmd:template');

/**
 * Handle the !template command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  const subcommand = (args[0] || '').toLowerCase();

  switch (subcommand) {
    case 'list':
      await handleList(msg);
      break;
    case 'use':
      await handleUse(msg, args.slice(1));
      break;
    case 'save':
      await handleSave(msg, args.slice(1));
      break;
    default:
      await msg.reply([
        '📋 *Template Commands:*',
        '• `!template list` — Lihat semua template',
        '• `!template use <name> <url>` — Gunakan template pada URL',
        '• `!template save <name>` — Simpan config sebagai template',
      ].join('\n'));
  }
}

/**
 * List all available templates.
 * @param {Object} msg
 */
async function handleList(msg) {
  try {
    const templates = await templateStore.listTemplates();
    if (templates.length === 0) {
      await msg.reply('📋 Belum ada template tersedia.');
      return;
    }

    let response = '📋 *Available Templates:*\n\n';
    templates.forEach((tpl, i) => {
      const badge = tpl.type === 'builtin' ? '🏷️' : '📝';
      response += `${i + 1}. ${badge} *${tpl.name}* — ${tpl.description}\n`;
    });
    response += '\nGunakan: `!template use <name> <url>`';

    await msg.reply(response);
  } catch (err) {
    log.error('Template list failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

/**
 * Use a template on a URL.
 * @param {Object} msg
 * @param {string[]} args - [templateName, url]
 */
async function handleUse(msg, args) {
  const templateName = args[0];
  const url = args[1];

  if (!templateName || !url) {
    await msg.reply('❌ Gunakan: `!template use <name> <url>`');
    return;
  }

  try {
    const template = await templateStore.getTemplate(templateName);
    if (!template) {
      await msg.reply(`❌ Template "${templateName}" tidak ditemukan. Gunakan \`!template list\`.`);
      return;
    }

    await msg.reply(`🔧 Menggunakan template *${templateName}* pada:\n${truncate(url, 60)}`);

    const result = await deepScrape(url, {
      extract: 'all',
      waitFor: template.waitFor,
    });

    let response = `📊 *Template: ${templateName}*\n🔗 ${url}\n\n`;

    // Apply template selectors to extract named fields
    for (const [fieldName, selectors] of Object.entries(template.selectors)) {
      response += `*${fieldName}:* `;
      // Deep scrape already extracted everything, match from result
      if (fieldName === 'title') response += result.title || 'N/A';
      else if (fieldName === 'images') response += `${result.images?.length || 0} found`;
      else if (fieldName === 'content' || fieldName === 'description') {
        response += truncate(result.paragraphs?.join(' ') || result.description || 'N/A', 200);
      } else {
        response += 'See full results';
      }
      response += '\n';
    }

    await msg.reply(response);
    log.info(`Template ${templateName} applied to ${url}`);
  } catch (err) {
    log.error('Template use failed', { error: err.message });
    await msg.reply(`❌ Template gagal: ${err.message}`);
  }
}

/**
 * Save a custom template (placeholder — requires interactive input).
 * @param {Object} msg
 * @param {string[]} args
 */
async function handleSave(msg, args) {
  const name = args[0];
  if (!name) {
    await msg.reply('❌ Gunakan: `!template save <name>`\nKirim JSON template sebagai reply.');
    return;
  }

  // Check if replying to a JSON message
  const quoted = await msg.getQuotedMessage?.();
  if (!quoted) {
    await msg.reply('❌ Reply ke pesan berisi JSON template.\nFormat: `{"selectors": {"title": ["h1", ".title"]}}`');
    return;
  }

  try {
    const templateData = JSON.parse(quoted.body);
    await templateStore.saveTemplate(name, templateData);
    await msg.reply(`✅ Template "${name}" tersimpan!`);
  } catch (err) {
    await msg.reply(`❌ JSON tidak valid: ${err.message}`);
  }
}

module.exports = { handle, command: 'template', description: 'Manage scrape templates' };
