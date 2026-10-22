'use strict';

/**
 * @fileoverview Test fixtures: Mock helpers for WhatsApp message simulation and test isolation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Create a mock WhatsApp message envelope.
 * @param {string} body - Message text content
 * @param {string} [from='628123456789@c.us'] - Sender ID
 * @param {Object} [overrides={}] - Optional custom overrides
 * @returns {Object}
 */
function createMockMsg(body, from = '628123456789@c.us', overrides = {}) {
  const replies = [];
  const reactions = [];

  const msg = {
    id: { id: `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
    body,
    from,
    to: 'bot@c.us',
    timestamp: Math.floor(Date.now() / 1000),
    hasMedia: false,
    type: 'chat',
    replies,
    reactions,
    reply: jest.fn(async (content, chatId, options) => {
      replies.push({ content, chatId, options });
      return { id: { id: `reply_${Date.now()}` }, body: content };
    }),
    react: jest.fn(async (emoji) => {
      reactions.push(emoji);
      return true;
    }),
    getChat: jest.fn(async () => ({
      id: { _serialized: from },
      isGroup: false,
      sendStateTyping: jest.fn(async () => true),
      clearState: jest.fn(async () => true),
    })),
    getContact: jest.fn(async () => ({
      id: { _serialized: from },
      pushname: 'TestUser',
      number: from.replace('@c.us', ''),
    })),
    getMentions: jest.fn(async () => []),
    ...overrides,
  };

  return msg;
}

/**
 * Create a mock WhatsApp client instance.
 * @param {Object} [overrides={}]
 * @returns {Object}
 */
function createMockClient(overrides = {}) {
  const sentMessages = [];
  return {
    info: {
      wid: { _serialized: 'bot@c.us', user: 'bot' },
      pushname: 'Rima Bot Assistant',
    },
    sentMessages,
    sendMessage: jest.fn(async (chatId, content, options) => {
      sentMessages.push({ chatId, content, options });
      return { id: { id: `sent_${Date.now()}` }, body: content };
    }),
    getChats: jest.fn(async () => []),
    ...overrides,
  };
}

/**
 * Create an isolated temporary test directory.
 * @param {string} prefix
 * @returns {{ dirPath: string, cleanup: () => void }}
 */
function createTempTestDir(prefix = 'e2e_test_') {
  const base = path.join(process.cwd(), '.test_tmp');
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  const dirPath = path.join(base, `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dirPath, { recursive: true });

  return {
    dirPath,
    cleanup: () => {
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      } catch { /* ignore */ }
    },
  };
}

module.exports = {
  createMockMsg,
  createMockClient,
  createTempTestDir,
};
