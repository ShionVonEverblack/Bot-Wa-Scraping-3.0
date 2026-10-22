'use strict';

/**
 * @fileoverview Bottleneck-based async job queue with cancellation and timeout support.
 * @module jobs/jobQueue
 */

const Bottleneck = require('bottleneck');
const config = require('../config');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('jobs:queue');

const limiter = new Bottleneck({
  maxConcurrent: config.limits?.maxConcurrency || 3,
  minTime: 500,
});

/** @type {Map<string, AbortController>} */
const controllers = new Map();
const runningJobs = new Set();

let runningCount = 0;
let queuedCount = 0;

/**
 * Execute a task within timeout and abort signal monitoring.
 * Rejects immediately with JOB_CANCELLED if controller aborts during execution.
 * @param {Function} taskFn
 * @param {AbortController} controller
 * @param {number} timeoutMs
 * @returns {Promise<*>}
 */
async function executeWithTimeout(taskFn, controller, timeoutMs) {
  let timer = null;
  let timedOut = false;

  try {
    const taskPromise = taskFn(controller.signal);

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        const err = new Error(`Job timed out after ${timeoutMs}ms`);
        err.code = 'JOB_TIMEOUT';
        reject(err);
      }, timeoutMs);
      if (timer.unref) timer.unref();
    });

    const abortPromise = new Promise((_, reject) => {
      if (controller.signal.aborted && !timedOut) {
        setImmediate(() => {
          const err = new Error('Job cancelled');
          err.code = 'JOB_CANCELLED';
          reject(err);
        });
        return;
      }
      controller.signal.addEventListener('abort', () => {
        if (timedOut) return;
        setImmediate(() => {
          const err = new Error('Job cancelled');
          err.code = 'JOB_CANCELLED';
          reject(err);
        });
      }, { once: true });
    });

    return await Promise.race([
      taskPromise,
      timeoutPromise,
      abortPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Enqueue a task for a specific jobId.
 * @param {string} jobId
 * @param {(signal: AbortSignal) => Promise<*>} taskFn
 * @returns {Promise<*>}
 */
function enqueue(jobId, taskFn) {
  const controller = new AbortController();
  controllers.set(jobId, controller);
  queuedCount++;

  const timeoutMs = config.limits?.jobTimeoutMs || 120000;

  const promise = limiter.schedule({ id: jobId }, async () => {
    if (controller.signal.aborted) {
      controllers.delete(jobId);
      const err = new Error('Job cancelled before execution');
      err.code = 'JOB_CANCELLED';
      throw err;
    }

    queuedCount = Math.max(0, queuedCount - 1);
    runningCount++;
    runningJobs.add(jobId);

    try {
      return await executeWithTimeout(taskFn, controller, timeoutMs);
    } finally {
      runningJobs.delete(jobId);
      runningCount = Math.max(0, runningCount - 1);
      controllers.delete(jobId);
    }
  });

  // Prevent unhandled rejection when caller doesn't await enqueue
  promise.catch(err => {
    log.debug(`Queue task ${jobId} finished with error: ${err.message}`);
  });

  return promise;
}

/**
 * Cancel a queued or running job by jobId.
 * @param {string} jobId
 * @returns {boolean} true if abort signal was triggered
 */
function cancel(jobId) {
  const controller = controllers.get(jobId);
  if (!controller) return false;

  if (!runningJobs.has(jobId)) {
    queuedCount = Math.max(0, queuedCount - 1);
  }

  controller.abort();
  controllers.delete(jobId);
  log.info(`Cancelled job in queue: ${jobId}`);
  return true;
}

/**
 * Get current queue statistics.
 * @returns {{ running: number, queued: number }}
 */
function getStats() {
  return {
    running: runningCount,
    queued: queuedCount,
  };
}

/**
 * Gracefully stop the job queue.
 * @returns {Promise<void>}
 */
async function shutdown() {
  for (const [, controller] of controllers.entries()) {
    controller.abort();
  }
  controllers.clear();
  runningJobs.clear();
  try {
    await limiter.stop({ dropWaitingJobs: true });
  } catch { /* ignore */ }
  runningCount = 0;
  queuedCount = 0;
  log.info('Job queue shut down');
}

module.exports = {
  enqueue,
  cancel,
  getStats,
  shutdown,
  executeWithTimeout,
};
