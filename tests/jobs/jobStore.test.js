'use strict';

/**
 * @fileoverview Unit tests for jobStore service.
 */

const fs = require('fs');
const path = require('path');

const TEST_JOBS_DIR = path.resolve(__dirname, '..', '..', '.test_tmp_jobs');

jest.mock('../../src/config', () => {
  const path = require('path');
  const actual = jest.requireActual('../../src/config');
  return {
    ...actual,
    dirs: {
      ...actual.dirs,
      jobs: path.resolve(__dirname, '..', '..', '.test_tmp_jobs'),
    },
  };
});

const jobStore = require('../../src/jobs/jobStore');
const { JOB_STATUS, JOB_TYPES } = require('../../src/jobs/jobSchemas');

beforeAll(async () => {
  await fs.promises.rm(TEST_JOBS_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(TEST_JOBS_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.promises.rm(TEST_JOBS_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  jobStore.clearAll();
  const files = await fs.promises.readdir(TEST_JOBS_DIR);
  for (const file of files) {
    await fs.promises.unlink(path.join(TEST_JOBS_DIR, file));
  }
});

describe('jobStore', () => {
  describe('createJob and getJob', () => {
    test('creates and stores a job with default pending status', async () => {
      const request = {
        type: JOB_TYPES.SCRAPE_GENERAL,
        userId: 'user123',
        chatId: 'chat123',
        keyword: 'quantum computing',
      };

      const job = await jobStore.createJob(request);

      expect(job).toBeDefined();
      expect(job.jobId).toBeDefined();
      expect(job.status).toBe(JOB_STATUS.PENDING);
      expect(job.request.userId).toBe('user123');
      expect(job.request.keyword).toBe('quantum computing');

      // Check on disk
      const filePath = path.join(TEST_JOBS_DIR, `${job.jobId}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      const onDisk = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      expect(onDisk.jobId).toBe(job.jobId);
    });

    test('getJob returns null for non-existent or invalid jobId', async () => {
      expect(await jobStore.getJob(null)).toBeNull();
      expect(await jobStore.getJob('')).toBeNull();
      expect(await jobStore.getJob('non-existent-id')).toBeNull();
    });

    test('getJob retrieves from disk when not in memory', async () => {
      const job = await jobStore.createJob({ userId: 'u1', keyword: 'test' });
      jobStore.clearAll(); // Flush memory

      const loaded = await jobStore.getJob(job.jobId);
      expect(loaded).toBeDefined();
      expect(loaded.jobId).toBe(job.jobId);
      expect(loaded.request.keyword).toBe('test');
    });
  });

  describe('saveJob and updateJob', () => {
    test('saveJob overwrites memory and persists to disk', async () => {
      const job = await jobStore.createJob({ userId: 'u2', keyword: 'ai' });
      job.status = JOB_STATUS.RUNNING;
      job.customField = 'custom_val';

      await jobStore.saveJob(job);

      const retrieved = await jobStore.getJob(job.jobId);
      expect(retrieved.status).toBe(JOB_STATUS.RUNNING);
      expect(retrieved.customField).toBe('custom_val');
    });

    test('updateJob updates status, error, and timestamp fields', async () => {
      const job = await jobStore.createJob({ userId: 'u3' });
      const startedAt = new Date().toISOString();

      const updated = await jobStore.updateJob(job.jobId, {
        status: JOB_STATUS.RUNNING,
        startedAt,
      });

      expect(updated.status).toBe(JOB_STATUS.RUNNING);
      expect(updated.startedAt).toBe(startedAt);

      const completedAt = new Date().toISOString();
      const failed = await jobStore.updateJob(job.jobId, {
        status: JOB_STATUS.FAILED,
        completedAt,
        error: 'Network timeout',
      });

      expect(failed.status).toBe(JOB_STATUS.FAILED);
      expect(failed.completedAt).toBe(completedAt);
      expect(failed.error).toBe('Network timeout');
    });

    test('updateJob merges progress and result objects', async () => {
      const job = await jobStore.createJob({ userId: 'u4' });

      await jobStore.updateJob(job.jobId, {
        progress: { percent: 50, message: 'Processing' },
      });

      let current = await jobStore.getJob(job.jobId);
      expect(current.progress.percent).toBe(50);
      expect(current.progress.message).toBe('Processing');

      await jobStore.updateJob(job.jobId, {
        progress: { percent: 100 },
        result: { itemCount: 42 },
      });

      current = await jobStore.getJob(job.jobId);
      expect(current.progress.percent).toBe(100);
      expect(current.progress.message).toBe('Processing'); // Preserved from previous merge
      expect(current.result.itemCount).toBe(42);
    });

    test('updateJob returns null for unknown jobId', async () => {
      const result = await jobStore.updateJob('unknown_id', { status: JOB_STATUS.FAILED });
      expect(result).toBeNull();
    });
  });

  describe('listJobs and getStats', () => {
    test('lists jobs filtered by userId and status', async () => {
      await jobStore.createJob({ userId: 'alice', keyword: 'job1' });
      const job2 = await jobStore.createJob({ userId: 'bob', keyword: 'job2' });
      await jobStore.createJob({ userId: 'alice', keyword: 'job3' });

      await jobStore.updateJob(job2.jobId, { status: JOB_STATUS.COMPLETED });

      const allAlice = await jobStore.listJobs({ userId: 'alice' });
      expect(allAlice.length).toBe(2);

      const completed = await jobStore.listJobs({ status: JOB_STATUS.COMPLETED });
      expect(completed.length).toBe(1);
      expect(completed[0].jobId).toBe(job2.jobId);

      const limited = await jobStore.listJobs({ limit: 1 });
      expect(limited.length).toBe(1);
    });

    test('getStats aggregates counts by status correctly', async () => {
      const j1 = await jobStore.createJob({ userId: 'u1' });
      const j2 = await jobStore.createJob({ userId: 'u2' });
      const j3 = await jobStore.createJob({ userId: 'u3' });

      await jobStore.updateJob(j1.jobId, { status: JOB_STATUS.COMPLETED });
      await jobStore.updateJob(j2.jobId, { status: JOB_STATUS.FAILED });

      const stats = await jobStore.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byStatus[JOB_STATUS.COMPLETED]).toBe(1);
      expect(stats.byStatus[JOB_STATUS.FAILED]).toBe(1);
      expect(stats.byStatus[JOB_STATUS.PENDING]).toBe(1);
    });
  });

  describe('purgeExpiredJobs', () => {
    test('purges finished jobs older than maxAgeMs and removes files', async () => {
      const dummyResultFile = path.join(TEST_JOBS_DIR, 'result_artifact.txt');
      await fs.promises.writeFile(dummyResultFile, 'sample output content');

      const oldJob = await jobStore.createJob({ userId: 'uOld' });
      oldJob.createdAt = new Date(Date.now() - 100000).toISOString();
      oldJob.status = JOB_STATUS.COMPLETED;
      oldJob.result = { files: [dummyResultFile] };
      await jobStore.saveJob(oldJob);

      const recentJob = await jobStore.createJob({ userId: 'uRecent' });
      await jobStore.updateJob(recentJob.jobId, { status: JOB_STATUS.COMPLETED });

      const pendingOldJob = await jobStore.createJob({ userId: 'uPendingOld' });
      pendingOldJob.createdAt = new Date(Date.now() - 100000).toISOString();
      pendingOldJob.status = JOB_STATUS.PENDING; // Should NOT be purged
      await jobStore.saveJob(pendingOldJob);

      const purgeResult = await jobStore.purgeExpiredJobs({ maxAgeMs: 50000, deleteFiles: true });

      expect(purgeResult.purged).toBe(1);
      expect(purgeResult.filesDeleted).toBeGreaterThanOrEqual(1);

      // Check that old completed job is gone
      expect(await jobStore.getJob(oldJob.jobId)).toBeNull();
      expect(fs.existsSync(dummyResultFile)).toBe(false);

      // Check that recent and pending jobs remain
      expect(await jobStore.getJob(recentJob.jobId)).toBeDefined();
      expect(await jobStore.getJob(pendingOldJob.jobId)).toBeDefined();
    });
  });
});
