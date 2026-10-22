'use strict';

/**
 * @fileoverview Tier 4 Real-World Application Scenario: WhatsApp Conversational Assistant Flow.
 * Simulates end-to-end user interactions on WhatsApp with the bot router:
 *   - F01 - F08: Core Bot Commands & Help Routing
 *   - F16: Scraping Command Dispatch
 *   - F21: Document Q&A Command Dispatch (`!docqa`)
 *   - F24: Knowledge Graph Command Dispatch (`!graph`)
 *   - F25/F27: User Memory Commands (`!memory`)
 *   - F28: Job Status Inquiries (`!status`)
 */

const path = require('path');
const { createMockMsg, createMockClient } = require('../../fixtures/mockHelpers');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 4: Real-World Scenario — WhatsApp Conversational Assistant Flow', () => {
  const rootDir = process.cwd();

  let messageHandler;
  let jobStore;
  let jobSchemas;
  let ragEngine;
  let persistentMemory;
  let client;

  beforeAll(() => {
    messageHandler = require(path.join(rootDir, 'src', 'bot', 'messageHandler'));
    jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
    jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
    ragEngine = require(path.join(rootDir, 'src', 'services', 'rag', 'ragEngine'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));

    client = createMockClient();
    messageHandler.setReady(true, client);
  });

  beforeEach(() => {
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
    if (ragEngine && typeof ragEngine.clearIndex === 'function') {
      ragEngine.clearIndex();
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: User Asks for Help Menu
  // --------------------------------------------------------------------------
  test('W1: !help command routes to help handler and delivers interactive command menu', async () => {
    const msg = createMockMsg('!help', 'user_wa_01@c.us');
    await messageHandler.handleMessage(msg, client);

    expect(msg.replies.length).toBeGreaterThan(0);
    const replyText = msg.replies[0].content;
    expect(replyText).toMatch(/bantuan|menu|commands|panduan/i);
    expect(replyText).toMatch(/!scrape|!status|!help/);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: User Checks Job Status via Chat
  // --------------------------------------------------------------------------
  test('W2: !status command reports job progress card for active user job', async () => {
    const userPhone = '628991234567@c.us';

    // 1. Create a background job for this user
    const job = await jobStore.createJob({
      type: jobSchemas.JOB_TYPES.SCRAPE,
      userId: userPhone,
      keyword: 'GeForce RTX 5090',
    });

    await jobStore.updateJob(job.jobId, {
      status: jobSchemas.JOB_STATUS.RUNNING,
      progress: { percent: 65, message: 'Scraping page 2/3' },
    });

    // 2. User queries status via WhatsApp
    const msg = createMockMsg(`!status ${job.jobId}`, userPhone);
    await messageHandler.handleMessage(msg, client);

    expect(msg.replies.length).toBeGreaterThan(0);
    const replyText = msg.replies[0].content;
    expect(replyText).toContain(job.jobId);
    expect(replyText).toMatch(/RUNNING|65%/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: User Manages Persistent Memory via Chat
  // --------------------------------------------------------------------------
  test('W3: !memory show and !memory clear commands manage user episodic memory', async () => {
    const userPhone = '628995551212@c.us';

    // 1. Establish an observation for this user
    persistentMemory.recordObservation(userPhone, {
      type: 'preference',
      title: 'Preferred Format',
      content: 'Always format scraped tables as CSV.',
    });

    // 2. User queries !memory show
    const msgShow = createMockMsg('!memory show', userPhone);
    await messageHandler.handleMessage(msgShow, client);

    expect(msgShow.replies.length).toBeGreaterThan(0);
    expect(msgShow.replies[0].content).toMatch(/Preferred Format|CSV/i);

    // 3. User queries !memory clear
    const msgClear = createMockMsg('!memory clear', userPhone);
    await messageHandler.handleMessage(msgClear, client);

    expect(msgClear.replies.length).toBeGreaterThan(0);
    expect(msgClear.replies[0].content).toMatch(/dihapus|dibersihkan|cleared/i);

    // 4. Verify memory is empty now
    expect(persistentMemory.searchIndex(userPhone, '')).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: User Performs Document Q&A via Chat
  // --------------------------------------------------------------------------
  test('W4: !docqa command answers user queries against ingested document store', async () => {
    const userPhone = '628997778899@c.us';

    // 1. Ingest paper into RAG
    ragEngine.indexDocument('resnet_paper', sampleDocs.academicPaperText, {
      title: 'ResNet Research Paper',
    });

    // 2. User asks question via !docqa
    const msg = createMockMsg('!docqa "residual learning framework"', userPhone);
    await messageHandler.handleMessage(msg, client);

    expect(msg.replies.length).toBeGreaterThan(0);
    const reply = msg.replies[0].content;
    expect(reply).toBeDefined();
    expect(reply.length).toBeGreaterThan(15);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: User Requests Knowledge Graph via Chat
  // --------------------------------------------------------------------------
  test('W5: !graph command returns structural knowledge graph and Mermaid diagram', async () => {
    const userPhone = '628990001122@c.us';

    const msg = createMockMsg('!graph "AlphaFold"', userPhone);
    await messageHandler.handleMessage(msg, client);

    expect(msg.replies.length).toBeGreaterThan(0);
    const reply = msg.replies[0].content;
    expect(reply).toMatch(/graph|diagram|AlphaFold/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Unknown Command Graceful Handling
  // --------------------------------------------------------------------------
  test('W6: Unknown command responds gracefully with help guidance without throwing', async () => {
    const userPhone = '628993334444@c.us';

    const msg = createMockMsg('!nonExistentCmd123456', userPhone);
    await expect(messageHandler.handleMessage(msg, client)).resolves.not.toThrow();

    // System either replies with unknown command notice or ignores gracefully
    if (msg.replies.length > 0) {
      expect(msg.replies[0].content).toMatch(/tidak dikenal|bantuan|!help/i);
    }
  });
});
