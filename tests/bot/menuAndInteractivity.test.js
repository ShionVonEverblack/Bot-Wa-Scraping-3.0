'use strict';

/**
 * @fileoverview Unit and integration tests for interactive WhatsApp Poll Menu,
 * vote handling, fuzzy typo suggestions, and reaction feedback.
 */

const { createMockMsg, createMockClient } = require('../fixtures/mockHelpers');
const menuHandler = require('../../src/commands/handlers/menu.handler');
const messageHandler = require('../../src/bot/messageHandler');
const jobManager = require('../../src/jobs/jobManager');
const jobQueue = require('../../src/jobs/jobQueue');
const { Poll } = require('whatsapp-web.js');

describe('Interactive WhatsApp Menu & UI/UX Enhancements', () => {
  let client;

  beforeEach(() => {
    client = createMockClient();
    messageHandler.setReady(true, client);
    messageHandler.pendingInteractiveActions.clear();
    jest.spyOn(jobManager, 'createJob').mockResolvedValue({
      jobId: 'mock_interactive_job_1',
      type: 'SCRAPE',
      status: 'PENDING',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await jobQueue.shutdown();
  });

  // --------------------------------------------------------------------------
  // 1. Menu Handler Tests
  // --------------------------------------------------------------------------
  describe('menuHandler', () => {
    test('sends WhatsApp Native Poll when client is available', async () => {
      const msg = createMockMsg('!menu', 'user_menu_01@c.us');
      msg.client = client;

      await menuHandler.handle(msg, [], client);

      expect(client.sentMessages.length).toBe(1);
      const sentItem = client.sentMessages[0];
      expect(sentItem.content).toBeInstanceOf(Poll);
      expect(sentItem.content.pollName).toContain('Menu Utama');
      expect(sentItem.content.pollOptions.length).toBe(6);
      expect(sentItem.content.options.allowMultipleAnswers).toBe(false);
    });

    test('falls back to text menu when "text" or "teks" mode is requested', async () => {
      const msg = createMockMsg('!menu text', 'user_menu_02@c.us');
      await menuHandler.handle(msg, ['text'], client);

      expect(msg.replies.length).toBe(1);
      expect(msg.replies[0].content).toContain('Menu Utama');
      expect(msg.replies[0].content).toContain('!scrape');
      expect(msg.replies[0].content).toContain('!crawl');
    });

    test('falls back to text menu when Poll sending throws an error', async () => {
      const msg = createMockMsg('!menu', 'user_menu_03@c.us');
      const brokenClient = {
        sendMessage: jest.fn().mockRejectedValue(new Error('Poll not supported by protocol')),
      };

      await menuHandler.handle(msg, [], brokenClient);

      expect(msg.replies.length).toBe(1);
      expect(msg.replies[0].content).toContain('Menu Utama');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Poll Vote Update Handling
  // --------------------------------------------------------------------------
  describe('handleVoteUpdate', () => {
    test('handles vote for Option 1 (Scrape): prompts user and sets pending state', async () => {
      const voter = 'voter_01@c.us';
      const mockVote = {
        voter,
        selectedOptions: [{ name: '🔍 1. Cari Data (Scrape)', localId: 0 }],
        parentMessage: { id: { remote: voter }, from: voter, to: 'bot@c.us' },
      };

      await messageHandler.handleVoteUpdate(mockVote, client);

      expect(client.sentMessages.length).toBe(1);
      expect(client.sentMessages[0].content).toContain('Pencarian Data (Scrape)');
      expect(messageHandler.pendingInteractiveActions.has(voter)).toBe(true);
      expect(messageHandler.pendingInteractiveActions.get(voter).action).toBe('SCRAPE');

      // Next user message executes !scrape
      const followUpMsg = createMockMsg('kucing anggora', voter);
      await messageHandler.handleMessage(followUpMsg, client);

      // Pending action should be consumed
      expect(messageHandler.pendingInteractiveActions.has(voter)).toBe(false);
      expect(jobManager.createJob).toHaveBeenCalled();
    });

    test('handles vote for Option 2 (Crawl): prompts for URL and sets CRAWL action', async () => {
      const voter = 'voter_02@c.us';
      const mockVote = {
        voter,
        selectedOptions: [{ name: '🕸️ 2. Crawl Website (LLM)', localId: 1 }],
        parentMessage: { id: { remote: voter } },
      };

      await messageHandler.handleVoteUpdate(mockVote, client);

      expect(client.sentMessages.length).toBe(1);
      expect(client.sentMessages[0].content).toContain('LLM-Ready Web Crawler');
      expect(messageHandler.pendingInteractiveActions.get(voter).action).toBe('CRAWL');
    });

    test('handles vote for Option 3 (Paper): prompts for DOI/arXiv and sets PAPER action', async () => {
      const voter = 'voter_03@c.us';
      const mockVote = {
        voter,
        selectedOptions: [{ name: '📄 3. Download Paper PDF', localId: 2 }],
        parentMessage: { id: { remote: voter } },
      };

      await messageHandler.handleVoteUpdate(mockVote, client);

      expect(client.sentMessages.length).toBe(1);
      expect(client.sentMessages[0].content).toContain('Download Paper PDF');
      expect(messageHandler.pendingInteractiveActions.get(voter).action).toBe('PAPER');
    });

    test('handles vote for Option 5 (Tanya AI): prompts for query and sets AI action', async () => {
      const voter = 'voter_05@c.us';
      const mockVote = {
        voter,
        selectedOptions: [{ name: '🤖 5. Tanya AI / Asisten', localId: 4 }],
        parentMessage: { id: { remote: voter } },
      };

      await messageHandler.handleVoteUpdate(mockVote, client);

      expect(client.sentMessages.length).toBe(1);
      expect(client.sentMessages[0].content).toContain('Tanya AI / Asisten');
      expect(messageHandler.pendingInteractiveActions.get(voter).action).toBe('AI');
    });

    test('safely ignores empty or deselected votes', async () => {
      const mockVote = {
        voter: 'voter_empty@c.us',
        selectedOptions: [],
      };

      await messageHandler.handleVoteUpdate(mockVote, client);
      expect(client.sentMessages.length).toBe(0);
      expect(messageHandler.pendingInteractiveActions.size).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Fuzzy Command Matching & Typo Suggestions
  // --------------------------------------------------------------------------
  describe('Fuzzy Command Matching', () => {
    test('corrects common typo "!scraep" to "!scrape"', () => {
      const match = messageHandler.findClosestCommand('scraep');
      expect(match).toBe('scrape');
    });

    test('corrects typo "!cralw" to "!crawl"', () => {
      const match = messageHandler.findClosestCommand('cralw');
      expect(match).toBe('crawl');
    });

    test('corrects typo "!hepl" to "!help"', () => {
      const match = messageHandler.findClosestCommand('hepl');
      expect(match).toBe('help');
    });

    test('returns null for completely unrelated gibberish', () => {
      const match = messageHandler.findClosestCommand('xyzqweasdzxc');
      expect(match).toBeNull();
    });

    test('bot replies with smart typo suggestion when user sends misspelled command', async () => {
      const msg = createMockMsg('!scraep kucing lucu', 'user_typo_01@c.us');
      await messageHandler.handleMessage(msg, client);

      expect(msg.replies.length).toBe(1);
      expect(msg.replies[0].content).toContain('!scraep');
      expect(msg.replies[0].content).toContain('!scrape');
      expect(msg.replies[0].content).toContain('!menu');
      expect(msg.reactions).toContain('❓');
    });
  });

  // --------------------------------------------------------------------------
  // 4. WhatsApp Reaction Feedback
  // --------------------------------------------------------------------------
  describe('Reaction Status', () => {
    test('reacts with ⏳ then ✅ on successful command execution', async () => {
      const msg = createMockMsg('!health', 'user_react_01@c.us');
      await messageHandler.handleMessage(msg, client);

      expect(msg.reactions).toContain('⏳');
      expect(msg.reactions).toContain('✅');
    });
  });
});
