'use strict';

/**
 * @fileoverview Job storage service — in-memory Map backed by JSON files in config.dirs.jobs.
 * @module jobs/jobStore
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ensureDir, writeJson, readJson } = require('../utils/fsUtil');
const { createLogger } = require('../services/monitor/logger');
const { createJobObject, JOB_STATUS } = require('./jobSchemas');

const log = createLogger('jobs:store');

/** @type {Map<string, Object>} */
const jobs = new Map();

/**
 * Get path for a job JSON file on disk.
 * @param {string} jobId
 * @returns {string}
 */
function getJobFilePath(jobId) {
  return path.join(config.dirs.jobs || './jobs', `${jobId}.json`);
}

/**
 * Persist job to disk (best effort).
 * @param {Object} job
 * @returns {Promise<void>}
 */
async function persistJob(job) {
  try {
    await ensureDir(config.dirs.jobs || './jobs');
    await writeJson(getJobFilePath(job.jobId), job);
  } catch (err) {
    log.debug(`Could not persist job ${job.jobId} to disk`, { error: err.message });
  }
}

/**
 * Create and store a new job.
 * @param {Object} request
 * @returns {Promise<Object>}
 */
async function createJob(request) {
  const job = createJobObject(request);
  jobs.set(job.jobId, job);
  await persistJob(job);
  return job;
}

/**
 * Save or overwrite a job object.
 * @param {Object} job
 * @returns {Promise<Object>}
 */
async function saveJob(job) {
  jobs.set(job.jobId, job);
  await persistJob(job);
  return job;
}

/**
 * Retrieve a job by ID (from memory or disk).
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
async function getJob(jobId) {
  if (!jobId) return null;
  if (jobs.has(jobId)) {
    return jobs.get(jobId);
  }

  const fromDisk = await readJson(getJobFilePath(jobId));
  if (fromDisk && fromDisk.jobId) {
    jobs.set(fromDisk.jobId, fromDisk);
    return fromDisk;
  }

  return null;
}

/**
 * Update fields on an existing job.
 * @param {string} jobId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateJob(jobId, updates = {}) {
  const job = await getJob(jobId);
  if (!job) return null;

  // Terminal state guard: a CANCELLED job must not be overwritten by COMPLETED or RUNNING
  if (job.status === JOB_STATUS.CANCELLED && updates.status && updates.status !== JOB_STATUS.CANCELLED) {
    return job;
  }

  if (updates.status !== undefined) job.status = updates.status;
  if (updates.error !== undefined) job.error = updates.error;
  if (updates.startedAt !== undefined) job.startedAt = updates.startedAt;
  if (updates.completedAt !== undefined) job.completedAt = updates.completedAt;

  if (updates.progress) {
    job.progress = { ...job.progress, ...updates.progress };
  }

  if (updates.result) {
    job.result = { ...job.result, ...updates.result };
  }

  jobs.set(jobId, job);
  await persistJob(job);
  return job;
}

/**
 * List jobs sorted by createdAt descending.
 * @param {Object} [filter]
 * @param {string} [filter.userId]
 * @param {string} [filter.status]
 * @param {number} [filter.limit=20]
 * @returns {Promise<Object[]>}
 */
async function listJobs({ userId, status, limit = 20 } = {}) {
  // Load any jobs on disk not yet in memory
  try {
    const dir = config.dirs.jobs || './jobs';
    if (fs.existsSync(dir)) {
      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = path.basename(file, '.json');
        if (!jobs.has(id)) {
          const data = await readJson(path.join(dir, file));
          if (data && data.jobId) jobs.set(data.jobId, data);
        }
      }
    }
  } catch { /* ignore disk scan errors */ }

  let all = Array.from(jobs.values());

  if (userId) {
    all = all.filter(j => j.request?.userId === userId);
  }
  if (status) {
    all = all.filter(j => j.status === status);
  }

  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return all.slice(0, limit);
}

/**
 * Get aggregate job statistics.
 * @returns {Promise<{ total: number, byStatus: Object<string, number> }>}
 */
async function getStats() {
  const all = await listJobs({ limit: 10000 });
  const byStatus = {};
  for (const job of all) {
    byStatus[job.status] = (byStatus[job.status] || 0) + 1;
  }
  return {
    total: all.length,
    byStatus,
  };
}

/**
 * Purge expired jobs older than maxAgeMs.
 * @param {Object} [options]
 * @param {number} [options.maxAgeMs=604800000] - Default 7 days
 * @param {boolean} [options.deleteFiles=true]
 * @returns {Promise<{ purged: number, filesDeleted: number }>}
 */
async function purgeExpiredJobs({ maxAgeMs = 7 * 24 * 60 * 60 * 1000, deleteFiles = true } = {}) {
  const now = Date.now();
  let purged = 0;
  let filesDeleted = 0;

  const all = await listJobs({ limit: 10000 });
  for (const job of all) {
    const created = new Date(job.createdAt).getTime();
    if (now - created > maxAgeMs && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      jobs.delete(job.jobId);
      purged++;

      if (deleteFiles) {
        try {
          await fs.promises.unlink(getJobFilePath(job.jobId));
          filesDeleted++;
        } catch { /* ignore */ }

        if (Array.isArray(job.result?.files)) {
          for (const f of job.result.files) {
            try {
              await fs.promises.unlink(f);
              filesDeleted++;
            } catch { /* ignore */ }
          }
        }
      }
    }
  }

  return { purged, filesDeleted };
}

/**
 * Clear all jobs in memory (primarily for tests).
 */
function clearAll() {
  jobs.clear();
}

module.exports = {
  createJob,
  saveJob,
  getJob,
  updateJob,
  listJobs,
  getStats,
  purgeExpiredJobs,
  clearAll,
};
