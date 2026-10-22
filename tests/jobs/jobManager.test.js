'use strict';

/**
 * @fileoverview Unit tests for jobManager service.
 */

const fs = require('fs');
const path = require('path');

const TEST_JOBS_DIR = path.resolve(__dirname, '..', '..', '.test_tmp_jobs_mgr');

jest.mock('../../src/config', () => {
  const path = require('path');
  const actual = jest.requireActual('../../src/config');
  return {
    ...actual,
    dirs: {
      ...actual.dirs,
      jobs: path.resolve(__dirname, '..', '..', '.test_tmp_jobs_mgr'),
    },
    group: {
      denyList: ['banned-user'],
      allowList: [], // Default empty = anyone allowed
    },
  };
});

jest.mock('../../src/jobs/jobQueue', () => ({
  enqueue: jest.fn().mockImplementation(async (jobId, taskFn) => {
    const controller = new AbortController();
    return taskFn(controller.signal);
  }),
  cancel: jest.fn().mockReturnValue(true),
  getStats: jest.fn().mockReturnValue({ running: 0, queued: 0 }),
  shutdown: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/jobs/jobWorker', () => ({
  processScrapeJob: jest.fn().mockImplementation(async (job) => {
    return { success: true, count: 5 };
  }),
}));

jest.mock('../../src/jobs/paperWorker', () => ({
  processPaperJob: jest.fn().mockImplementation(async (job) => {
    return { success: true, paper: 'test-paper.pdf' };
  }),
}));

const jobStore = require('../../src/jobs/jobStore');
const jobQueue = require('../../src/jobs/jobQueue');
const jobManager = require('../../src/jobs/jobManager');
const { processScrapeJob } = require('../../src/jobs/jobWorker');
const { processPaperJob } = require('../../src/jobs/paperWorker');
const { JOB_STATUS, JOB_TYPES } = require('../../src/jobs/jobSchemas');
const config = require('../../src/config');

beforeAll(async () => {
  await fs.promises.rm(TEST_JOBS_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(TEST_JOBS_DIR, { recursive: true });
});

afterAll(async () => {
  await jobQueue.shutdown();
  await fs.promises.rm(TEST_JOBS_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  jobStore.clearAll();
  jest.clearAllMocks();
  config.group.denyList = ['banned-user'];
  config.group.allowList = [];

  const files = await fs.promises.readdir(TEST_JOBS_DIR);
  for (const file of files) {
    await fs.promises.unlink(path.join(TEST_JOBS_DIR, file));
  }
});

describe('jobManager', () => {
  describe('createJob validation and access control', () => {
    test('throws error if request is missing', async () => {
      await expect(jobManager.createJob({})).rejects.toThrow('Job request is required');
    });

    test('rejects user in denyList with ACCESS_DENIED', async () => {
      const request = {
        userId: 'banned-user@c.us',
        keyword: 'test',
        type: JOB_TYPES.SCRAPE_GENERAL,
      };

      await expect(jobManager.createJob({ request })).rejects.toMatchObject({
        code: 'ACCESS_DENIED',
        message: 'User is in deny list',
      });
    });

    test('rejects user not in allowList when allowList is active', async () => {
      config.group.allowList = ['vip-user'];

      const request = {
        userId: 'regular-user@c.us',
        keyword: 'test',
        type: JOB_TYPES.SCRAPE_GENERAL,
      };

      await expect(jobManager.createJob({ request })).rejects.toMatchObject({
        code: 'ACCESS_DENIED',
        message: 'User is not in allow list',
      });
    });

    test('allows user in allowList when allowList is active', async () => {
      config.group.allowList = ['vip-user'];

      const request = {
        userId: 'vip-user@c.us',
        keyword: 'test',
        type: JOB_TYPES.SCRAPE_GENERAL,
      };

      const job = await jobManager.createJob({ request });
      expect(job).toBeDefined();
      expect(job.status).toBe(JOB_STATUS.PENDING);
    });
  });

  describe('job dispatching and worker execution', () => {
    test('dispatches scrape job to processScrapeJob', async () => {
      const request = {
        userId: 'alice@c.us',
        keyword: 'astronomy',
        type: JOB_TYPES.SCRAPE_GENERAL,
      };

      const job = await jobManager.createJob({ request });
      expect(job).toBeDefined();

      // Wait for async queue execution
      await new Promise((r) => setTimeout(r, 100));

      expect(processScrapeJob).toHaveBeenCalled();
      const calledJob = processScrapeJob.mock.calls[0][0];
      expect(calledJob.jobId).toBe(job.jobId);
    });

    test('dispatches paper download job to processPaperJob', async () => {
      const request = {
        userId: 'bob@c.us',
        paperId: 'arxiv:1234.5678',
        type: JOB_TYPES.DOWNLOAD_PAPER,
      };

      const job = await jobManager.createJob({ request });
      expect(job).toBeDefined();

      await new Promise((r) => setTimeout(r, 100));

      expect(processPaperJob).toHaveBeenCalled();
      const calledJob = processPaperJob.mock.calls[0][0];
      expect(calledJob.jobId).toBe(job.jobId);
    });

    test('handles worker failure and sends message to client', async () => {
      processScrapeJob.mockImplementationOnce(async () => {
        throw new Error('Upstream provider rate limited');
      });

      const mockClient = {
        sendMessage: jest.fn().mockResolvedValue(true),
      };

      const request = {
        userId: 'charlie@c.us',
        chatId: 'charlie-chat',
        keyword: 'fail-test',
        type: JOB_TYPES.SCRAPE_GENERAL,
      };

      const job = await jobManager.createJob({ request, client: mockClient });

      await new Promise((r) => setTimeout(r, 150));

      const updatedJob = await jobStore.getJob(job.jobId);
      expect(updatedJob.status).toBe(JOB_STATUS.FAILED);
      expect(updatedJob.error).toBe('Upstream provider rate limited');

      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        'charlie-chat',
        expect.stringContaining('gagal: Upstream provider rate limited')
      );
    });
  });

  describe('getJobStatus and cancelJob', () => {
    test('getJobStatus returns current job state', async () => {
      const job = await jobStore.createJob({ userId: 'u1', keyword: 'status-check' });
      const fetched = await jobManager.getJobStatus(job.jobId);

      expect(fetched).toBeDefined();
      expect(fetched.jobId).toBe(job.jobId);
    });

    test('cancelJob cancels queued job and updates store status', async () => {
      const job = await jobStore.createJob({ userId: 'u2', keyword: 'to-cancel' });
      const cancelled = await jobManager.cancelJob(job.jobId);

      expect(cancelled.status).toBe(JOB_STATUS.CANCELLED);
      expect(cancelled.progress.message).toBe('Cancelled by user');

      const inStore = await jobStore.getJob(job.jobId);
      expect(inStore.status).toBe(JOB_STATUS.CANCELLED);
    });

    test('cancelJob returns null for unknown jobId', async () => {
      const result = await jobManager.cancelJob('unknown-id');
      expect(result).toBeNull();
    });
  });

  describe('resumePending', () => {
    test('resumes interrupted PENDING and RUNNING jobs on startup', async () => {
      const jPending = await jobStore.createJob({ userId: 'u3', keyword: 'pending-job' });
      const jRunning = await jobStore.createJob({ userId: 'u4', keyword: 'running-job' });
      const jCompleted = await jobStore.createJob({ userId: 'u5', keyword: 'done-job' });

      await jobStore.updateJob(jRunning.jobId, { status: JOB_STATUS.RUNNING });
      await jobStore.updateJob(jCompleted.jobId, { status: JOB_STATUS.COMPLETED });

      const resumedCount = await jobManager.resumePending();
      expect(resumedCount).toBe(2);

      const afterPending = await jobStore.getJob(jPending.jobId);
      const afterRunning = await jobStore.getJob(jRunning.jobId);
      const afterDone = await jobStore.getJob(jCompleted.jobId);

      expect(afterPending.progress.message).toBe('Resumed after restart');
      expect(afterRunning.status).toBe(JOB_STATUS.PENDING);
      expect(afterDone.status).toBe(JOB_STATUS.COMPLETED);
    });
  });
});
