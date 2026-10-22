'use strict';

/**
 * @fileoverview Skills command handler — browse, inspect, and activate installed Agent Skills.
 * Command: !skills [list|info|use|off] [skillName]
 * @module commands/handlers/skills
 */

const skillRegistry = require('../../services/skills/skillRegistry');
const { truncate } = require('../../utils/text');

/**
 * Handle !skills command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const contact = await msg.getContact();
  const userId = contact.id._serialized;
  const sub = (args[0] || 'list').toLowerCase();
  const target = args.slice(1).join(' ').trim();

  if (sub === 'info' || sub === 'view' || sub === 'show') {
    const skill = skillRegistry.getSkill(target);
    if (!skill) {
      await msg.reply(`❌ Skill \`${target}\` tidak ditemukan. Ketik \`!skills\` untuk daftar.`);
      return;
    }

    await msg.reply(
      [
        `🧩 *Skill: ${skill.name}* (\`${skill.id}\`)`,
        `📂 Pack: ${skill.category}`,
        `📝 ${skill.description}`,
        '━━━━━━━━━━━━━━━━━━━━━━',
        truncate(skill.content, 1400),
      ].join('\n')
    );
    return;
  }

  if (sub === 'use' || sub === 'activate' || sub === 'apply') {
    const skill = skillRegistry.setActiveSkill(userId, target);
    if (!skill) {
      await msg.reply(`❌ Skill \`${target}\` tidak ditemukan.`);
      return;
    }
    await msg.reply(`✅ Skill *${skill.name}* (\`${skill.id}\`) diaktifkan untuk sesi AI Anda!`);
    return;
  }

  if (sub === 'off' || sub === 'clear' || sub === 'none') {
    skillRegistry.setActiveSkill(userId, null);
    await msg.reply('🧹 Skill aktif dinonaktifkan.');
    return;
  }

  const query = sub === 'list' ? target : args.join(' ').trim();
  const skills = skillRegistry.listSkills(query);
  const active = skillRegistry.getActiveSkill(userId);

  const grouped = new Map();
  for (const s of skills) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category).push(s);
  }

  const sections = [];
  for (const [category, items] of grouped.entries()) {
    const sample = items
      .slice(0, 5)
      .map(s => `  • \`${s.id}\` — ${truncate(s.description, 60)}`)
      .join('\n');
    const extra = items.length > 5 ? `\n  _... +${items.length - 5} skills lainnya_` : '';
    sections.push(`📦 *${category}* (${items.length}):\n${sample}${extra}`);
  }

  await msg.reply(
    [
      `🧩 *Installed Agent Skills (${skills.length} total)*`,
      active ? `🟢 Active Skill: \`${active.id}\`` : '',
      '',
      sections.slice(0, 8).join('\n\n'),
      '',
      '💡 *Commands:*',
      '• `!skills info <nama>` — Detail instruksi skill',
      '• `!skills use <nama>` — Aktifkan skill pada chat AI',
      '• `!skills list <kata>` — Filter skill',
    ].filter(Boolean).join('\n')
  );
}

module.exports = { handle, command: 'skills', description: 'List and activate installed Agent Skills' };
