'use strict';

/**
 * @fileoverview Lang command — switch bot response language.
 * Command: !lang id|en
 * @module commands/handlers/lang
 */

/** Per-user language preferences. */
const userLangs = new Map();

async function handle(msg, args) {
  const contact = await msg.getContact();
  const userId = contact.id._serialized;
  const lang = (args[0] || '').toLowerCase();

  if (!lang) {
    const current = userLangs.get(userId) || 'id';
    await msg.reply(`🌐 Bahasa saat ini: *${current === 'id' ? 'Indonesia' : 'English'}*\n\nGanti: \`!lang id\` atau \`!lang en\``);
    return;
  }

  if (lang !== 'id' && lang !== 'en') {
    await msg.reply('❌ Pilihan: `!lang id` (Indonesia) atau `!lang en` (English)');
    return;
  }

  userLangs.set(userId, lang);
  const confirmation = lang === 'id'
    ? '✅ Bahasa diubah ke *Bahasa Indonesia*'
    : '✅ Language changed to *English*';
  await msg.reply(confirmation);
}

/**
 * Get user's language preference.
 * @param {string} userId
 * @returns {string} 'id' or 'en'
 */
function getLang(userId) {
  return userLangs.get(userId) || 'id';
}

module.exports = { handle, getLang, command: 'lang', description: 'Switch language' };
