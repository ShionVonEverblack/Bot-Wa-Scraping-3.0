'use strict';

/**
 * @fileoverview Job manager — coordinates job creation, access control, queueing,
 * cancellation, status retrieval, and startup resume.
 * @module jobs/jobManager
 */

const config = require('../config');
const { createLogger } = require('../services/monitor/logger');
const jobStore = require('./jobStore');
const jobQueue = require('./jobQueue');
const { processScrapeJob } = require('./jobWorker');
const { processPaperJob } = require('./paperWorker');
const { JOB_STATUS, JOB_TYPES } = require('./jobSchemas');

const log = createLogger('jobs:manager');

/**
 * Dispatch a job to the appropriate worker inside the queue.
 * @param {Object} job
 * @param {Object} [client]
 */
function dispatchJob(job, client) {
  jobQueue.enqueue(job.jobId, async (signal) => {
    try {
      if (job.type === JOB_TYPES.DOWNLOAD_PAPER) {
        return await processPaperJob(job, client, signal);
      }
      return await processScrapeJob(job, client, signal);
    } catch (err) {
      if (err.code === 'JOB_CANCELLED' || (signal && signal.aborted)) {
        await jobStore.updateJob(job.jobId, {
          status: JOB_STATUS.CANCELLED,
          completedAt: new Date().toISOString(),
          error: 'Cancelled',
        });
        return;
      }

      log.error(`Job ${job.jobId} failed`, { error: err.message });
      await jobStore.updateJob(job.jobId, {
        status: JOB_STATUS.FAILED,
        completedAt: new Date().toISOString(),
        error: err.message,
      });

      if (client && job.request?.chatId && typeof client.sendMessage === 'function') {
        try {
          await client.sendMessage(
            job.request.chatId,
            `❌ Job \`${job.jobId}\` gagal: ${err.message}`
          );
        } catch { /* ignore */ }
      }
    }
  });
}

/**
 * Create a new job, validate access control, and enqueue it.
 * @param {Object} params
 * @param {Object} params.request - Job request configuration
 * @param {Object} [params.client] - WhatsApp client instance
 * @returns {Promise<Object>} Created job object
 */
async function createJob({ request, client }) {
  if (!request) {
    throw new Error('Job request is required');
  }

  const userId = request.userId || '';
  const allowList = config.security?.allowList || config.group?.allowList || [];
  const denyList = config.security?.denyList || config.group?.denyList || [];

  if (Array.isArray(denyList) && denyList.length > 0 && userId && denyList.some(p => userId.includes(p))) {
    const err = new Error('User is in deny list');
    err.code = 'ACCESS_DENIED';
    throw err;
  }

  if (Array.isArray(allowList) && allowList.length > 0) {
    if (!userId || !allowList.some(p => userId.includes(p))) {
      const err = new Error('User is not in allow list');
      err.code = 'ACCESS_DENIED';
      throw err;
    }
  }

  const job = await jobStore.createJob(request);
  log.info(`Job created: ${job.jobId} (${job.type})`);

  dispatchJob(job, client);
  return job;
}

/**
 * Get the current status of a job.
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
async function getJobStatus(jobId) {
  return jobStore.getJob(jobId);
}

/**
 * Cancel a job by ID.
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
async function cancelJob(jobId) {
  const job = await jobStore.getJob(jobId);
  if (!job) return null;

  jobQueue.cancel(jobId);

  const updated = await jobStore.updateJob(jobId, {
    status: JOB_STATUS.CANCELLED,
    completedAt: new Date().toISOString(),
    progress: { percent: 0, message: 'Cancelled by user' },
  });

  return updated;
}

/**
 * Resume any PENDING or interrupted RUNNING jobs from disk on startup.
 * @param {Object} [client]
 * @returns {Promise<number>} Count of resumed jobs
 */
async function resumePending(client) {
  const all = await jobStore.listJobs({ limit: 200 });
  let count = 0;

  for (const job of all) {
    if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.RUNNING) {
      // Corrupted/legacy job files without a request payload cannot be executed.
      // Mark them FAILED immediately instead of dispatching a doomed async task.
      if (!job.request || typeof job.request !== 'object') {
        log.warn(`Skipping resume of job ${job.jobId}: missing request payload`);
        await jobStore.updateJob(job.jobId, {
          status: JOB_STATUS.FAILED,
          completedAt: new Date().toISOString(),
          error: 'Corrupted job: missing request payload',
        });
        continue;
      }

      await jobStore.updateJob(job.jobId, {
        status: JOB_STATUS.PENDING,
        progress: { percent: 0, message: 'Resumed after restart' },
      });
      dispatchJob(job, client);
      count++;
    }
  }

  return count;
}

module.exports = {
  createJob,
  getJobStatus,
  cancelJob,
  resumePending,
};
