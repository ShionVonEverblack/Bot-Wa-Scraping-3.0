'use strict';

/**
 * @fileoverview Wizard command handler.
 * Command: !wizard — starts guided step-by-step search flow.
 * @module commands/handlers/wizard
 */

async function handle(msg, args, client) {
  const contact = await msg.getContact();
  const userId = contact.id._serialized;

  const { startWizard } = require('../../bot/wizard/wizardHandler');
  await startWizard(msg, userId);
}

module.exports = { handle, command: 'wizard', description: 'Start guided search wizard' };
