'use strict';

const httpClient = require('../../src/utils/httpClient');
const ollamaProvider = require('../../src/services/ai/providers/ollama.provider');
const aiService = require('../../src/services/ai/aiService');
const messageHandler = require('../../src/bot/messageHandler');
const pauseHandler = require('../../src/commands/handlers/pause.handler');
const contextMemory = require('../../src/bot/nlp/contextMemory');
const ragEngine = require('../../src/services/rag/ragEngine');
const { checkClientHealth, startHealthWatchdog, stopHealthWatchdog } = require('../../src/bot/client');

function createDocMockMsg({
  body = '',
  filename = 'riset_ai_2026.txt',
  mimetype = 'text/plain',
  content = 'Penelitian ini membahas arsitektur Multi-Agent RAG pada tahun 2026 dengan akurasi 98.4%.',
  userId = '628111999888@c.us',
  chatId = '628111999888@c.us',
  isGroup = false,
  type = 'document',
} = {}) {
  const replies = [];
  const reactions = [];
  const base64Data = Buffer.from(content, 'utf8').toString('base64');

  return {
    body,
    type,
    hasMedia: true,
    filename,
    from: chatId,
    to: 'bot@c.us',
    isStatus: false,
    replies,
    reactions,
    downloadMedia: jest.fn(async () => ({
      data: base64Data,
      mimetype,
      filename,
    })),
    reply: jest.fn(async (text) => {
      replies.push(text);
      return { body: text };
    }),
    react: jest.fn(async (emoji) => {
      reactions.push(emoji);
    }),
    getContact: jest.fn(async () => ({
      id: { _serialized: userId },
      pushname: 'Researcher',
    })),
    getChat: jest.fn(async () => ({
      id: { _serialized: chatId },
      name: isGroup ? 'Grup Riset Kampus' : 'Researcher',
      isGroup,
      sendStateTyping: jest.fn(async () => {}),
      sendMessage: jest.fn(async () => {}),
    })),
    getMentions: jest.fn(async () => []),
  };
}

describe('Phase 2 Features: Direct Document Drop (NotebookLM), Ollama Local AI, & Puppeteer Watchdog', () => {
  const mockClient = {
    sendMessage: jest.fn(async () => {}),
  };

  beforeAll(() => {
    messageHandler.setReady(true, mockClient);
  });

  beforeEach(() => {
    pauseHandler.clearAllChatStates();
    ragEngine.clearIndex();
    delete process.env.OLLAMA_ENABLED;
    delete process.env.OLLAMA_MODEL;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    stopHealthWatchdog();
  });

  describe('1. Direct PDF / Document Drop (Ala Google NotebookLM)', () => {
    test('automatically indexes dropped document in DM (even without caption), syncs contextMemory, and replies with overview', async () => {
      const userId = 'user_doc_dm@c.us';
      contextMemory.clear(userId);

      const docMsg = createDocMockMsg({
        body: '',
        filename: 'laporan_kuartal.txt',
        mimetype: 'text/plain',
        content: 'Pendapatan kuartal ketiga meningkat sebesar 42% berkat efisiensi rantai pasok dan automasi AI.',
        userId,
        chatId: userId,
        isGroup: false,
      });

      await messageHandler.handleMessage(docMsg, mockClient);

      // Should have replied with indexed confirmation & overview
      expect(docMsg.replies.length).toBeGreaterThan(0);
      expect(docMsg.replies[0]).toMatch(/Dokumen Diindeks/i);
      expect(docMsg.replies[0]).toMatch(/laporan_kuartal\.txt/i);

      // Should have synced into contextMemory as Active Focus Document
      const ctx = contextMemory.get(userId);
      expect(ctx).not.toBeNull();
      expect(ctx.lastDocumentTitle).toBe('laporan_kuartal.txt');
      expect(ctx.lastDocumentText).toContain('42%');

      // Should also be indexed in ragEngine
      const stats = ragEngine.getStats();
      expect(stats.totalDocuments).toBeGreaterThanOrEqual(1);
    });

    test('does NOT chime in ("nimbrung") when a document is sent in a Group without mentioning @Rima', async () => {
      const groupMsg = createDocMockMsg({
        body: 'Ini file jadwal kuliah kita ya teman-teman, terima kasih',
        filename: 'jadwal_kuliah.pdf',
        mimetype: 'application/pdf',
        userId: 'student1@c.us',
        chatId: 'group_kampus@g.us',
        isGroup: true,
      });

      await messageHandler.handleMessage(groupMsg, mockClient);

      expect(groupMsg.downloadMedia).not.toHaveBeenCalled();
      expect(groupMsg.replies).toHaveLength(0);
    });

    test('DOES process document in a Group when @Rima is explicitly mentioned in the caption', async () => {
      const groupMentionMsg = createDocMockMsg({
        body: 'Halo @rima tolong rangkum isi dokumen panduan ini',
        filename: 'panduan_skripsi.md',
        mimetype: 'text/markdown',
        content: '# Bab 1 Pendahuluan\nMahasiswa wajib menyertakan minimal 20 referensi jurnal bereputasi.',
        userId: 'student2@c.us',
        chatId: 'group_kampus@g.us',
        isGroup: true,
      });

      await messageHandler.handleMessage(groupMentionMsg, mockClient);

      expect(groupMentionMsg.downloadMedia).toHaveBeenCalledTimes(1);
      expect(groupMentionMsg.replies.length).toBeGreaterThan(0);
      expect(groupMentionMsg.replies[0]).toMatch(/Dokumen Diindeks/i);
      expect(groupMentionMsg.replies[0]).toMatch(/panduan_skripsi\.md/i);
    });
  });

  describe('2. Ollama Local AI Provider (ollama.provider.js & aiService)', () => {
    test('throws KEY_MISSING when Ollama is not enabled', async () => {
      process.env.OLLAMA_ENABLED = 'false';
      await expect(
        ollamaProvider.generate({
          messages: [{ role: 'user', content: 'Halo' }],
        })
      ).rejects.toMatchObject({ code: 'KEY_MISSING' });
    });

    test('calls local Ollama /api/chat endpoint when enabled or explicitly selected via aiService', async () => {
      const postSpy = jest.spyOn(httpClient, 'post').mockResolvedValue({
        data: {
          message: {
            role: 'assistant',
            content: 'Halo! Saya berjalan secara lokal melalui Ollama (llama3.2).',
          },
          prompt_eval_count: 18,
          eval_count: 14,
        },
      });

      const responseText = await aiService.chat('Jelaskan keunggulan local LLM', {
        aiProvider: 'ollama',
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, payload] = postSpy.mock.calls[0];
      expect(calledUrl).toBe('http://localhost:11434/api/chat');
      expect(payload.stream).toBe(false);
      expect(payload.messages.some(m => m.content.includes('local LLM'))).toBe(true);
      expect(responseText).toContain('Ollama');
    });
  });

  describe('3. Puppeteer Health Watchdog & Graceful Auto-Reconnect', () => {
    test('checkClientHealth reports healthy when client state is CONNECTED', async () => {
      const healthyClient = {
        getState: jest.fn(async () => 'CONNECTED'),
        destroy: jest.fn(async () => {}),
        initialize: jest.fn(async () => {}),
      };

      const res = await checkClientHealth(healthyClient, 2000);
      expect(res).toEqual({ healthy: true, state: 'CONNECTED', reconnected: false });
      expect(healthyClient.destroy).not.toHaveBeenCalled();
      expect(healthyClient.initialize).not.toHaveBeenCalled();
    });

    test('checkClientHealth performs graceful destroy + initialize when session is frozen or DISCONNECTED', async () => {
      const frozenClient = {
        getState: jest.fn(async () => 'DISCONNECTED'),
        destroy: jest.fn(async () => {}),
        initialize: jest.fn(async () => {}),
      };

      const res = await checkClientHealth(frozenClient, 2000);
      expect(res.healthy).toBe(false);
      expect(res.reconnected).toBe(true);
      expect(frozenClient.destroy).toHaveBeenCalledTimes(1);
      expect(frozenClient.initialize).toHaveBeenCalledTimes(1);
    });

    test('startHealthWatchdog and stopHealthWatchdog manage timer lifecycle cleanly', () => {
      const dummyClient = { getState: jest.fn(async () => 'CONNECTED') };
      const timer = startHealthWatchdog(dummyClient, 60000);
      expect(timer).toBeDefined();
      stopHealthWatchdog();
    });
  });
});
