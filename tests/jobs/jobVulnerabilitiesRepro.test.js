'use strict';

/**
 * @fileoverview Regression tests for src/jobs/ subsystem.
 * These cases were originally empirical bug reproductions discovered during
 * adversarial testing. The bugs have since been fixed, so the tests now lock in
 * the corrected behavior to prevent regressions.
 */

jest.mock('../../src/config', () => {
  const actual = jest.requireActual('../../src/config');
  return {
    ...actual,
    group: {
      denyList: [],
      allowList: ['authorized_vip@c.us'],
    },
  };
});

const jobStore = require('../../src/jobs/jobStore');
const jobQueue = require('../../src/jobs/jobQueue');
const jobManager = require('../../src/jobs/jobManager');
const { JOB_STATUS } = require('../../src/jobs/jobSchemas');

describe('Regression: src/jobs/ (formerly bug reproductions)', () => {
  beforeEach(() => {
    jobStore.clearAll();
  });

  afterAll(async () => {
    await jobQueue.shutdown();
  });

  // -------------------------------------------------------------------------
  // FIX 1: Security - AllowList must not be bypassed by missing/empty userId
  // -------------------------------------------------------------------------
  test('FIX 1: missing or empty userId is rejected when an allowList is configured', async () => {
    await expect(
      jobManager.createJob({
        request: { userId: 'unauthorized_stranger@c.us', keyword: 'test' },
      })
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });

    await expect(
      jobManager.createJob({ request: { keyword: 'unauthenticated_exploit' } })
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });

    await expect(
      jobManager.createJob({ request: { userId: '', keyword: 'unauthenticated_exploit' } })
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  // -------------------------------------------------------------------------
  // FIX 2: Correctness - terminal CANCELLED state must not be overwritten
  // -------------------------------------------------------------------------
  test('FIX 2: late worker completion does not overwrite a user-cancelled job', async () => {
    const job = await jobStore.createJob({ userId: 'alice', keyword: 'deep-scrape' });
    expect(job.status).toBe(JOB_STATUS.PENDING);

    const cancelled = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.CANCELLED,
      completedAt: new Date().toISOString(),
      error: 'Cancelled by user',
    });
    expect(cancelled.status).toBe(JOB_STATUS.CANCELLED);

    const afterLateUpdate = await jobStore.updateJob(job.jobId, {
      status: JOB_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      progress: { percent: 100, message: 'Completed' },
      result: { items: ['item1'] },
    });

    expect(afterLateUpdate.status).toBe(JOB_STATUS.CANCELLED);
    const inStore = await jobStore.getJob(job.jobId);
    expect(inStore.status).toBe(JOB_STATUS.CANCELLED);
  });

  // -------------------------------------------------------------------------
  // FIX 3: Availability - cancel() rejects even if task ignores AbortSignal
  // -------------------------------------------------------------------------
  test('FIX 3: jobQueue.cancel() rejects with JOB_CANCELLED even if task ignores AbortSignal', async () => {
    let taskRunning = false;
    let signalReceived;

    const taskPromise = jobQueue.enqueue('task-ignore-abort', async (signal) => {
      taskRunning = true;
      signalReceived = signal;
      // Task deliberately does not listen to signal 'abort'
      await new Promise((r) => setTimeout(r, 200));
      return 'task_completed_normally';
    });

    while (!taskRunning) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(jobQueue.cancel('task-ignore-abort')).toBe(true);
    expect(signalReceived.aborted).toBe(true);

    await expect(taskPromise).rejects.toMatchObject({ code: 'JOB_CANCELLED' });
  });

  // -------------------------------------------------------------------------
  // Cancelled-before-execution jobs reject cleanly and never run their task
  // -------------------------------------------------------------------------
  test('Jobs cancelled before execution reject with JOB_CANCELLED and never run', async () => {
    const count = 5;
    const taskFn = jest.fn(async () => 'ok');
    const promises = [];

    for (let i = 0; i < count; i++) {
      const id = `stall-${i}`;
      promises.push(jobQueue.enqueue(id, taskFn));
      jobQueue.cancel(id);
    }

    const results = await Promise.allSettled(promises);
    expect(results.every((r) => r.status === 'rejected' && r.reason.code === 'JOB_CANCELLED')).toBe(true);
    expect(taskFn).not.toHaveBeenCalled();
  }, 10000);
});
