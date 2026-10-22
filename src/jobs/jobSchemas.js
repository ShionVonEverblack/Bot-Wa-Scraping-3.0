'use strict';

/**
 * @fileoverview Job object schemas and status/type constants.
 * @module jobs/jobSchemas
 */

const { generateJobId } = require('../utils/id');

const JOB_STATUS = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

const JOB_TYPES = Object.freeze({
  SCRAPE: 'SCRAPE',
  DOWNLOAD_PAPER: 'DOWNLOAD_PAPER',
  CRAWL: 'CRAWL',
  WORKFLOW: 'WORKFLOW',
});

/**
 * Create a standardized job object.
 * @param {Object} request - Job request payload
 * @returns {Object} Initialized job object
 */
function createJobObject(request = {}) {
  const now = new Date().toISOString();
  const jobType = request.type || JOB_TYPES.SCRAPE;

  return {
    jobId: generateJobId(),
    type: jobType,
    status: JOB_STATUS.PENDING,
    request: {
      type: jobType,
      keyword: request.keyword || request.identifier || request.url || '',
      scrapeType: request.scrapeType || 'general',
      limit: request.limit || 10,
      format: request.format || 'json',
      provider: request.provider || null,
      useAI: !!request.useAI,
      multi: !!request.multi,
      page: request.page || 1,
      cursor: request.cursor || null,
      identifier: request.identifier || null,
      url: request.url || null,
      chatId: request.chatId || null,
      userId: request.userId || null,
    },
    progress: {
      percent: 0,
      message: 'Waiting in queue...',
    },
    result: {
      items: [],
      itemCount: 0,
      providerUsed: null,
      files: [],
      meta: {},
    },
    error: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  };
}

module.exports = {
  JOB_STATUS,
  JOB_TYPES,
  createJobObject,
};
