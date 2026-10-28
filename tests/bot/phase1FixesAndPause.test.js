'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const messageHandler = require('../../src/bot/messageHandler');
const pauseHandler = require('../../src/commands/handlers/pause.handler');
const contextMemory = require('../../src/bot/nlp/contextMemory');
const { cleanOldOutputs } = require('../../src/utils/storageCleanup');

function createChatMockMsg(body, {
  userId = '628111222333@c.us',
  chatId = '628111222333@c.us',
  isGroup = false,
  mentions = [],
} = {}) {
  const replies = [];
  const reactions = [];
  return {
    body,
    from: chatId,
    to: 'bot@c.us',
    hasMedia: false,
    isStatus: false,
    replies,
    reactions,
    reply: jest.fn(async (text) => {
      replies.push(text);
      return { body: text };
    }),
    react: jest.fn(async (emoji) => {
      reactions.push(emoji);
    }),
    getContact: jest.fn(async () => ({
      id: { _serialized: userId },
      pushname: 'Tester',
    })),
    getChat: jest.fn(async () => ({
      id: { _serialized: chatId },
      name: isGroup ? 'Grup Diskusi' : 'Tester',
      isGroup,
      sendStateTyping: jest.fn(async () => {}),
      sendMessage: jest.fn(async () => {}),
    })),
    getMentions: jest.fn(async () => mentions),
  };
}

describe('Phase 1 Fixes: Anti-Nimbrung (!pause, !resume, !mode), Word Boundary, Context Sync & Cleanup', () => {
  const mockClient = {
    sendMessage: jest.fn(async () => {}),
  };

  beforeAll(() => {
    messageHandler.setReady(true, mockClient);
  });

  beforeEach(() => {
    pauseHandler.clearAllChatStates();
    jest.clearAllMocks();
  });

  describe('1. Anti-Nimbrung Group Mention Word-Boundary Fix', () => {
    test('does NOT trigger on Indonesian words containing "rima" (terima kasih, darimana, kiriman, menerima)', async () => {
      const falsePositives = [
        'Terima kasih banyak pak atas infonya',
        'Kira-kira darimana ya datanya?',
        'Sudah menerima kiriman paket kemarin',
        'Dia memang primadona di kampus',
      ];

      for (const sentence of falsePositives) {
        const msg = createChatMockMsg(sentence, {
          userId: 'user1@c.us',
          chatId: 'group1@g.us',
          isGroup: true,
        });
        const mentioned = await messageHandler.isBotMentioned(msg);
        expect(mentioned).toBe(false);
      }
    });

    test('DOES trigger when bot name "Rima" is mentioned as a standalone word or @mention', async () => {
      const trueMentions = [
        'Halo rima, tolong carikan jurnal AI',
        'Rima! Apa kabar?',
        'Tolong bantuannya ya @rima',
        'rima cari gambar kucing',
      ];

      for (const sentence of trueMentions) {
        const msg = createChatMockMsg(sentence, {
          userId: 'user1@c.us',
          chatId: 'group1@g.us',
          isGroup: true,
        });
        const mentioned = await messageHandler.isBotMentioned(msg);
        expect(mentioned).toBe(true);
      }
    });
  });

  describe('2. !pause & !resume Per-Chat Silence Controls', () => {
    test('!pause silences all regular messages and commands in the chat until !resume is called', async () => {
      const chatId = 'chat_pause_test@g.us';

      // 1. User sends !pause
      const pauseMsg = createChatMockMsg('!pause', { chatId, userId: 'u1@c.us' });
      await messageHandler.handleMessage(pauseMsg, mockClient);
      expect(pauseHandler.isChatPaused(chatId)).toBe(true);
      expect(pauseMsg.replies[0]).toMatch(/Diheningkan|Paused/i);

      // 2. While paused, user sends casual chat, a URL, and a !help command -> all ignored
      const casualMsg = createChatMockMsg('Halo rima apa kabar?', { chatId, userId: 'u2@c.us' });
      await messageHandler.handleMessage(casualMsg, mockClient);
      expect(casualMsg.replies).toHaveLength(0);

      const helpMsg = createChatMockMsg('!help', { chatId, userId: 'u2@c.us' });
      await messageHandler.handleMessage(helpMsg, mockClient);
      expect(helpMsg.replies).toHaveLength(0);

      // 3. User sends !resume -> wakes up the bot
      const resumeMsg = createChatMockMsg('!resume', { chatId, userId: 'u1@c.us' });
      await messageHandler.handleMessage(resumeMsg, mockClient);
      expect(pauseHandler.isChatPaused(chatId)).toBe(false);
      expect(resumeMsg.replies[0]).toMatch(/Aktif Kembali/i);

      // 4. Now !help works again
      const helpAfterMsg = createChatMockMsg('!help', { chatId, userId: 'u2@c.us' });
      await messageHandler.handleMessage(helpAfterMsg, mockClient);
      expect(helpAfterMsg.replies.length).toBeGreaterThan(0);
    });

    test('!pause <duration> sets a timed pause that auto-expires', async () => {
      const chatId = 'chat_timed_pause@c.us';
      const pauseMsg = createChatMockMsg('!pause 15m', { chatId, userId: 'u1@c.us' });
      await messageHandler.handleMessage(pauseMsg, mockClient);

      const state = pauseHandler.getChatState(chatId);
      expect(state.mode).toBe('paused');
      expect(state.remainingMs).toBeGreaterThan(14 * 60 * 1000);
      expect(pauseMsg.replies[0]).toMatch(/15m/);
    });
  });

  describe('3. !mode command (Command-Only Mode)', () => {
    test('!mode command ignores casual chat and raw links but executes !commands', async () => {
      const chatId = 'chat_cmd_only@c.us';

      // Enable command-only mode
      const modeMsg = createChatMockMsg('!mode command', { chatId, userId: 'u1@c.us' });
      await messageHandler.handleMessage(modeMsg, mockClient);
      expect(pauseHandler.isCommandOnlyMode(chatId)).toBe(true);
      expect(modeMsg.replies[0]).toMatch(/Command-Only Aktif/i);

      // Casual message & raw link without '!' are ignored silently
      const casualMsg = createChatMockMsg('https://example.com ini link buat kamu ya', { chatId, userId: 'u1@c.us' });
      await messageHandler.handleMessage(casualMsg, mockClient);
      expect(casualMsg.replies).toHaveLength(0);

      // Explicit command '!help' is executed
      const helpMsg = createChatMockMsg('!help pause', { chatId, userId: 'u1@c.us' });
      await messageHandler.handleMessage(helpMsg, mockClient);
      expect(helpMsg.replies).toHaveLength(1);
      expect(helpMsg.replies[0]).toMatch(/Kontrol Anti-Nimbrung/i);
    });
  });

  describe('4. Context Memory Multi-Turn Sync (Smart Link Drop & !crawl)', () => {
    test('contextMemory.store maps lastUrlContent and lastUrlTitle to lastDocumentText and lastDocumentTitle', () => {
      const userId = 'ctx_sync_user@c.us';
      contextMemory.clear(userId);

      contextMemory.store(userId, {
        lastUrl: 'https://example.com/article',
        lastUrlContent: 'Isi artikel penting tentang kecerdasan buatan.',
        lastUrlTitle: 'Artikel AI 2026',
      });

      const ctx = contextMemory.get(userId);
      expect(ctx.lastUrl).toBe('https://example.com/article');
      expect(ctx.lastDocumentText).toBe('Isi artikel penting tentang kecerdasan buatan.');
      expect(ctx.lastDocumentTitle).toBe('Artikel AI 2026');
    });
  });

  describe('5. Storage Auto-Cleanup (cleanOldOutputs)', () => {
    test('deletes files older than maxAgeMs while preserving recent files and dotfiles', async () => {
      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rima-cleanup-'));
      const oldFile = path.join(tmpDir, 'old_response.md');
      const newFile = path.join(tmpDir, 'fresh_response.md');
      const dotFile = path.join(tmpDir, '.gitkeep');

      await fs.promises.writeFile(oldFile, 'old content');
      await fs.promises.writeFile(newFile, 'fresh content');
      await fs.promises.writeFile(dotFile, '');

      // Set oldFile mtime to 48 hours ago, dotFile to 48 hours ago
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await fs.promises.utimes(oldFile, twoDaysAgo, twoDaysAgo);
      await fs.promises.utimes(dotFile, twoDaysAgo, twoDaysAgo);

      const res = await cleanOldOutputs(tmpDir, 24 * 60 * 60 * 1000);
      expect(res.deletedCount).toBe(1);
      expect(res.deletedFiles).toContain('old_response.md');
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
      expect(fs.existsSync(dotFile)).toBe(true);

      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });
  });
});
