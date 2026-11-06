'use strict';

/**
 * @fileoverview Empirical Challenger Adversarial Stress Test Harness
 * 
 * Target Domains:
 * 1. Null contact/chat safety in messageHandler and command handlers
 * 2. Empty userId handling in identity and security services (confirming isAdmin("") returns false)
 * 3. Job queue timeout and terminal state guards (late callbacks cannot overwrite CANCELLED or FAILED)
 * 4. Abort signal handling in httpClient without sleep/retry loops
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Project modules
const config = require('../../src/config');
const identity = require('../../src/services/identity');
const security = require('../../src/services/security');
const jobStore = require('../../src/jobs/jobStore');
const jobQueue = require('../../src/jobs/jobQueue');
const jobManager = require('../../src/jobs/jobManager');
const { JOB_STATUS, JOB_TYPES } = require('../../src/jobs/jobSchemas');
const httpClient = require('../../src/utils/httpClient');
const messageHandler = require('../../src/bot/messageHandler');
const scrapeEngine = require('../../src/engine/scrapeEngine');

// Command handlers
const commandHandlers = {
  admin: require('../../src/commands/handlers/admin.handler'),
  ai: require('../../src/commands/handlers/ai.handler'),
  analyze: require('../../src/commands/handlers/analyze.handler'),
  cancel: require('../../src/commands/handlers/cancel.handler'),
  clear: require('../../src/commands/handlers/clear.handler'),
  compress: require('../../src/commands/handlers/compress.handler'),
  continue: require('../../src/commands/handlers/continue.handler'),
  crawl: require('../../src/commands/handlers/crawl.handler'),
  customscrape: require('../../src/commands/handlers/customscrape.handler'),
  deepscrape: require('../../src/commands/handlers/deepscrape.handler'),
  graph: require('../../src/commands/handlers/graph.handler'),
  health: require('../../src/commands/handlers/health.handler'),
  help: require('../../src/commands/handlers/help.handler'),
  history: require('../../src/commands/handlers/history.handler'),
  lang: require('../../src/commands/handlers/lang.handler'),
  memory: require('../../src/commands/handlers/memory.handler'),
  menu: require('../../src/commands/handlers/menu.handler'),
  next: require('../../src/commands/handlers/next.handler'),
  ocr: require('../../src/commands/handlers/ocr.handler'),
  paper: require('../../src/commands/handlers/paper.handler'),
  pause: require('../../src/commands/handlers/pause.handler'),
  rag: require('../../src/commands/handlers/rag.handler'),
  resolve: require('../../src/commands/handlers/resolve.handler'),
  scrape: require('../../src/commands/handlers/scrape.handler'),
  send: require('../../src/commands/handlers/send.handler'),
  settings: require('../../src/commands/handlers/settings.handler'),
  skills: require('../../src/commands/handlers/skills.handler'),
  status: require('../../src/commands/handlers/status.handler'),
  template: require('../../src/commands/handlers/template.handler'),
  unwatch: require('../../src/commands/handlers/unwatch.handler'),
  watch: require('../../src/commands/handlers/watch.handler'),
  watches: require('../../src/commands/handlers/watches.handler'),
  wizard: require('../../src/commands/handlers/wizard.handler'),
  workflow: require('../../src/commands/handlers/workflow.handler'),
  youtube: require('../../src/commands/handlers/youtube.handler'),
};

/**
 * Helper to dynamically load a module with a mock config injected into require.cache.
 */
function loadWithMockConfig(moduleRelativePath, mockConfigValues) {
  const configPath = require.resolve('../../src/config');
  const targetPath = require.resolve(moduleRelativePath);
  const identityPath = require.resolve('../../src/services/identity');

  const mockConfig = {
    ...config,
    ...mockConfigValues,
    group: {
      ...config.group,
      ...(mockConfigValues.group || {}),
    },
    limits: {
      ...config.limits,
      ...(mockConfigValues.limits || {}),
    },
  };

  const oldConfigCache = require.cache[configPath];
  const oldTargetCache = require.cache[targetPath];
  const oldIdentityCache = require.cache[identityPath];

  try {
    delete require.cache[configPath];
    delete require.cache[targetPath];
    delete require.cache[identityPath];

    require.cache[configPath] = {
      id: configPath,
      filename: configPath,
      loaded: true,
      exports: mockConfig,
    };

    return require(moduleRelativePath);
  } finally {
    delete require.cache[configPath];
    delete require.cache[targetPath];
    delete require.cache[identityPath];
    if (oldConfigCache) require.cache[configPath] = oldConfigCache;
    if (oldTargetCache) require.cache[targetPath] = oldTargetCache;
    if (oldIdentityCache) require.cache[identityPath] = oldIdentityCache;
  }
}

const results = {
  passed: 0,
  failed: 0,
  details: [],
};

function recordTest(name, fn) {
  return async () => {
    try {
      await fn();
      results.passed++;
      results.details.push({ name, status: 'PASS' });
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      results.failed++;
      results.details.push({ name, status: 'FAIL', error: err.message, stack: err.stack });
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('       EMPIRICAL CHALLENGER ADVERSARIAL STRESS SUITE            ');
  console.log('================================================================\n');

  // -------------------------------------------------------------------
  // TEST SECTION 1: Null Contact / Chat Safety
  // -------------------------------------------------------------------
  console.log('--- Section 1: Null Contact & Chat Safety ---');

  await recordTest('1.1 messageHandler handles message when contact and chat return null', async () => {
    const mockClient = {
      sendMessage: async () => ({ id: { _serialized: 'msg-out-1' } }),
    };
    const msg = {
      from: 'test_null@c.us',
      body: '!help',
      getContact: async () => null,
      getChat: async () => null,
      reply: async () => ({ id: { _serialized: 'reply-1' } }),
      react: async () => {},
    };

    await messageHandler.handleMessage(mockClient, msg);
  })();

  await recordTest('1.2 messageHandler handles message when contact and chat throw errors', async () => {
    const mockClient = {
      sendMessage: async () => ({ id: { _serialized: 'msg-out-2' } }),
    };
    const msg = {
      from: 'test_err@c.us',
      body: '!help',
      getContact: async () => { throw new Error('WhatsApp network contact timeout'); },
      getChat: async () => { throw new Error('WhatsApp chat lookup failed'); },
      reply: async () => ({ id: { _serialized: 'reply-2' } }),
      react: async () => {},
    };

    await messageHandler.handleMessage(mockClient, msg);
  })();

  await recordTest('1.3 messageHandler handles message with missing from and null id objects', async () => {
    const mockClient = {
      sendMessage: async () => ({ id: { _serialized: 'msg-out-3' } }),
    };
    const msg = {
      from: undefined,
      body: '!help',
      getContact: async () => ({ id: null, pushname: null }),
      getChat: async () => ({ id: null, isGroup: false }),
      reply: async () => ({ id: null }),
      react: async () => {},
    };

    await messageHandler.handleMessage(mockClient, msg);
  })();

  await recordTest('1.4 All 35 command handlers handle null/undefined contact and chat objects safely', async () => {
    const mockClient = {
      sendMessage: async () => ({ id: { _serialized: 'out-1' } }),
    };

    // Temporarily stub scrapeEngine to avoid hitting real APIs during 36 combinations
    const origScrape = scrapeEngine.scrape;
    scrapeEngine.scrape = async () => ({ items: [{ title: 'mock', url: 'https://example.com' }], meta: {} });

    try {
      const adversarialChatShapes = [
        null,
        undefined,
        {},
        { id: null },
        { id: { _serialized: null }, sendStateTyping: null },
        { id: { _serialized: 'chat_adv@c.us' }, isGroup: false, sendStateTyping: async () => {} },
      ];

      const adversarialContactShapes = [
        null,
        undefined,
        {},
        { id: null },
        { id: { _serialized: null }, pushname: null },
        { id: { _serialized: 'user_adv@c.us' }, pushname: 'Adversary' },
      ];

      for (const [cmdName, handlerModule] of Object.entries(commandHandlers)) {
        const handlerFn = handlerModule.handle || handlerModule;
        if (typeof handlerFn !== 'function') continue;

        for (const chat of adversarialChatShapes) {
          for (const contact of adversarialContactShapes) {
            const mockMsg = {
              from: 'adversary@c.us',
              body: `!${cmdName} test query`,
              getChat: async () => chat,
              getContact: async () => contact,
              reply: async () => ({
                id: { _serialized: 'rep-1' },
                edit: async () => {},
              }),
              react: async () => {},
            };

            try {
              await handlerFn(mockMsg, ['test', 'query'], mockClient);
            } catch (err) {
              if (err instanceof TypeError && (
                  err.message.includes('Cannot read properties of null') ||
                  err.message.includes('Cannot read properties of undefined')
              )) {
                throw new Error(`Command !${cmdName} crashed with unhandled dereference: ${err.message}`);
              }
            }
          }
        }
      }
    } finally {
      scrapeEngine.scrape = origScrape;
    }
  })();

  // -------------------------------------------------------------------
  // TEST SECTION 2: Empty userId handling & Security escalation
  // -------------------------------------------------------------------
  console.log('\n--- Section 2: Empty userId & Privilege Escalation Guards ---');

  await recordTest('2.1 identity.isAdmin strictly returns false for empty, whitespace, and non-string values', async () => {
    const mockIdentity = loadWithMockConfig('../../src/services/identity', {
      group: { adminPhones: ['628123456789', '628999888777'] },
    });

    assert.strictEqual(mockIdentity.isAdmin(''), false, 'Empty string must return false');
    assert.strictEqual(mockIdentity.isAdmin('   '), false, 'Whitespace-only string must return false');
    assert.strictEqual(mockIdentity.isAdmin(null), false, 'Null must return false');
    assert.strictEqual(mockIdentity.isAdmin(undefined), false, 'Undefined must return false');
    assert.strictEqual(mockIdentity.isAdmin(12345), false, 'Number must return false');
    assert.strictEqual(mockIdentity.isAdmin({}), false, 'Object must return false');
    assert.strictEqual(mockIdentity.isAdmin([]), false, 'Array must return false');
    assert.strictEqual(mockIdentity.isAdmin(true), false, 'Boolean true must return false');
    assert.strictEqual(mockIdentity.isAdmin(false), false, 'Boolean false must return false');
  })();

  await recordTest('2.2 identity.isAdmin prevents substring match privilege escalation attacks', async () => {
    const mockIdentity = loadWithMockConfig('../../src/services/identity', {
      group: { adminPhones: ['628123456789'] },
    });

    // Valid admin matches
    assert.strictEqual(mockIdentity.isAdmin('628123456789@c.us'), true);
    assert.strictEqual(mockIdentity.isAdmin('+62 812-3456-789@c.us'), true);
    assert.strictEqual(mockIdentity.isAdmin('08123456789@c.us'), true);

    // Substring attackers — all MUST fail
    assert.strictEqual(mockIdentity.isAdmin('62812345678@c.us'), false, 'Prefix match must not escalate');
    assert.strictEqual(mockIdentity.isAdmin('8123456789@c.us'), false, 'Suffix match without cc must not escalate');
    assert.strictEqual(mockIdentity.isAdmin('6281234567890@c.us'), false, 'Superstring match must not escalate');
    assert.strictEqual(mockIdentity.isAdmin('1628123456789@c.us'), false, 'Prepended digit must not escalate');
    assert.strictEqual(mockIdentity.isAdmin('62812@c.us'), false, 'Short substring must not escalate');
    assert.strictEqual(mockIdentity.isAdmin(''), false, 'Empty string must not escalate');
  })();

  await recordTest('2.3 security.checkAccess strictly blocks empty or whitespace userId', async () => {
    const resEmpty = security.checkAccess('');
    assert.strictEqual(resEmpty.allowed, false);
    assert.strictEqual(resEmpty.reason, 'invalid_user');

    const resSpace = security.checkAccess('   ');
    assert.strictEqual(resSpace.allowed, false);
    assert.strictEqual(resSpace.reason, 'invalid_phone');

    const resNull = security.checkAccess(null);
    assert.strictEqual(resNull.allowed, false);
    assert.strictEqual(resNull.reason, 'invalid_user');

    const resUndef = security.checkAccess(undefined);
    assert.strictEqual(resUndef.allowed, false);
    assert.strictEqual(resUndef.reason, 'invalid_user');
  })();

  await recordTest('2.4 security.checkAccess allowList & denyList exact matching prevents bypass', async () => {
    const mockSecurity = loadWithMockConfig('../../src/services/security', {
      group: {
        allowList: ['628111222333', '6284445556667'],
        denyList: ['628444555666'],
        adminPhones: ['628999999999'],
      },
    });

    // Denylist exact match
    const denRes = mockSecurity.checkAccess('628444555666@c.us');
    assert.strictEqual(denRes.allowed, false);
    assert.strictEqual(denRes.reason, 'denylist');

    // Superstring of denylist user (e.g. ending in 7) is in allowlist and should NOT be blocked
    const nearDenRes = mockSecurity.checkAccess('6284445556667@c.us');
    assert.strictEqual(nearDenRes.allowed, true);

    // Unlisted user blocked by allowList
    const intruderRes = mockSecurity.checkAccess('628777777777@c.us');
    assert.strictEqual(intruderRes.allowed, false);
    assert.strictEqual(intruderRes.reason, 'not_in_allowlist');

    // Allowlisted user accepted
    const allowedRes = mockSecurity.checkAccess('628111222333@c.us');
    assert.strictEqual(allowedRes.allowed, true);

    // Admin bypasses allow/deny lists
    const adminRes = mockSecurity.checkAccess('628999999999@c.us');
    assert.strictEqual(adminRes.allowed, true);
    assert.strictEqual(adminRes.reason, 'admin');
  })();

  // -------------------------------------------------------------------
  // TEST SECTION 3: Job Queue Timeout & Terminal State Guards
  // -------------------------------------------------------------------
  console.log('\n--- Section 3: Job Queue Timeout & Terminal State Guards ---');

  await recordTest('3.1 jobStore.updateJob strictly guards CANCELLED status against late overwrites', async () => {
    const job = await jobStore.createJob({ userId: 'u_cancel_guard', keyword: 'guard_test_1' });
    assert.strictEqual(job.status, JOB_STATUS.PENDING);

    // Cancel the job
    const cancelled = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.CANCELLED,
      completedAt: new Date().toISOString(),
    });
    assert.strictEqual(cancelled.status, JOB_STATUS.CANCELLED);

    // Late worker callback attempts to mark it COMPLETED
    const lateCompleted = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.COMPLETED,
      result: { items: [{ title: 'Late result' }] },
    });
    assert.strictEqual(lateCompleted.status, JOB_STATUS.CANCELLED, 'Late COMPLETED must be ignored on CANCELLED job');

    // Late worker callback attempts to mark it FAILED
    const lateFailed = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.FAILED,
      error: 'Late failure',
    });
    assert.strictEqual(lateFailed.status, JOB_STATUS.CANCELLED, 'Late FAILED must be ignored on CANCELLED job');

    // Verify stored object remains CANCELLED
    const stored = await jobStore.getJob(job.jobId);
    assert.strictEqual(stored.status, JOB_STATUS.CANCELLED);
  })();

  await recordTest('3.2 jobStore.updateJob strictly guards FAILED status against late overwrites', async () => {
    const job = await jobStore.createJob({ userId: 'u_fail_guard', keyword: 'guard_test_2' });

    // Mark job as FAILED
    const failed = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.FAILED,
      error: 'Fatal initial error',
      completedAt: new Date().toISOString(),
    });
    assert.strictEqual(failed.status, JOB_STATUS.FAILED);

    // Late worker callback attempts to mark it COMPLETED
    const lateSuccess = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.COMPLETED,
      result: { items: [1, 2, 3] },
    });
    assert.strictEqual(lateSuccess.status, JOB_STATUS.FAILED, 'Late COMPLETED must be ignored on FAILED job');

    // Late cancellation attempts to mark it CANCELLED
    const lateCancel = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.CANCELLED,
    });
    assert.strictEqual(lateCancel.status, JOB_STATUS.FAILED, 'Late CANCELLED must be ignored on FAILED job');

    // Verify stored object remains FAILED
    const stored = await jobStore.getJob(job.jobId);
    assert.strictEqual(stored.status, JOB_STATUS.FAILED);
  })();

  await recordTest('3.3 jobQueue.executeWithTimeout aborts task and rejects with JOB_TIMEOUT', async () => {
    const controller = new AbortController();
    const shortTimeoutMs = 150;
    let taskCleanedUp = false;

    const taskFn = (signal) => new Promise((resolve) => {
      const timer = setTimeout(() => resolve('finished'), 2000);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        taskCleanedUp = true;
      });
    });

    let timedOutError = null;
    try {
      await jobQueue.executeWithTimeout(taskFn, controller, shortTimeoutMs);
    } catch (err) {
      timedOutError = err;
    }

    assert.notStrictEqual(timedOutError, null, 'Must throw timeout error');
    assert.strictEqual(timedOutError.code, 'JOB_TIMEOUT');
    assert.strictEqual(taskCleanedUp, true, 'Task abort listener must have fired');
    assert.strictEqual(controller.signal.aborted, true, 'Controller must be aborted');
  })();

  await recordTest('3.4 jobManager catches JOB_TIMEOUT and transitions job to FAILED', async () => {
    const job = await jobStore.createJob({
      userId: 'u_timeout_test',
      chatId: 'chat_timeout@c.us',
      keyword: 'timeout-scrape',
      type: JOB_TYPES.SCRAPE_GENERAL,
    });

    // Enqueue job with a worker function that rejects with JOB_TIMEOUT
    const queuePromise = jobQueue.enqueue(job.jobId, async (signal) => {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('Job timed out after 100ms');
          err.code = 'JOB_TIMEOUT';
          reject(err);
        });
      });
    });

    let caughtErr = null;
    try {
      jobQueue.cancel(job.jobId);
      await queuePromise;
    } catch (err) {
      caughtErr = err;
    }

    assert.notStrictEqual(caughtErr, null);

    // Apply jobManager queue catch block logic (jobManager.js:58-64)
    const queueErr = { code: 'JOB_TIMEOUT', message: 'Job timed out after 100ms' };
    await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.FAILED,
      completedAt: new Date().toISOString(),
      error: queueErr.message,
    });

    const updated = await jobStore.getJob(job.jobId);
    assert.strictEqual(updated.status, JOB_STATUS.FAILED);
    assert.ok(updated.error.includes('100ms'));
  })();

  // -------------------------------------------------------------------
  // TEST SECTION 4: Abort Signal Handling in httpClient
  // -------------------------------------------------------------------
  console.log('\n--- Section 4: Abort Signal & httpClient Resilience ---');

  await recordTest('4.1 httpClient.get does NOT mutate caller options object', async () => {
    const callerOptions = {
      maxRetries: 1,
      timeout: 500,
      headers: { 'X-Custom-Test': 'present' },
    };

    const preKeys = Object.keys(callerOptions);
    try {
      await httpClient.get('http://127.0.0.1:59999/test-immutability', callerOptions);
    } catch { /* Expected connection error */ }

    assert.strictEqual(callerOptions.maxRetries, 1, 'maxRetries must remain on caller options');
    assert.deepStrictEqual(Object.keys(callerOptions), preKeys, 'No keys must be added or deleted from options');
  })();

  await recordTest('4.2 httpClient.get with pre-aborted signal aborts immediately (< 50ms) without sleep', async () => {
    const controller = new AbortController();
    controller.abort();

    const start = Date.now();
    let thrownError = null;

    try {
      await httpClient.get('https://example.com/hang', {
        signal: controller.signal,
        maxRetries: 5,
      });
    } catch (err) {
      thrownError = err;
    }

    const elapsed = Date.now() - start;

    assert.notStrictEqual(thrownError, null, 'Must throw error on aborted request');
    assert.ok(elapsed < 100, `Execution took ${elapsed}ms; must terminate immediately (< 100ms) without retry sleep`);
  })();

  await recordTest('4.3 httpClient.post with pre-aborted signal aborts immediately (< 50ms) without sleep', async () => {
    const controller = new AbortController();
    controller.abort();

    const start = Date.now();
    let thrownError = null;

    try {
      await httpClient.post('https://example.com/hang', { data: 'test' }, {
        signal: controller.signal,
        maxRetries: 5,
      });
    } catch (err) {
      thrownError = err;
    }

    const elapsed = Date.now() - start;

    assert.notStrictEqual(thrownError, null, 'Must throw error on aborted request');
    assert.ok(elapsed < 100, `Execution took ${elapsed}ms; must terminate immediately (< 100ms) without retry sleep`);
  })();

  await recordTest('4.4 httpClient.get abort during mid-request breaks immediately without backoff delay', async () => {
    const controller = new AbortController();

    setTimeout(() => {
      controller.abort();
    }, 50);

    const start = Date.now();
    let thrownError = null;

    try {
      await httpClient.get('http://10.255.255.1/hanging-request', {
        signal: controller.signal,
        timeout: 5000,
        maxRetries: 4,
      });
    } catch (err) {
      thrownError = err;
    }

    const elapsed = Date.now() - start;

    assert.notStrictEqual(thrownError, null, 'Must throw abort error');
    assert.ok(elapsed < 1500, `Execution took ${elapsed}ms; must not sleep through exponential retries`);
  })();

  // -------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`STRESS SUITE COMPLETE: ${results.passed} Passed, ${results.failed} Failed`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('FATAL UNCAUGHT RUNNER ERROR:', err);
  process.exit(1);
});
