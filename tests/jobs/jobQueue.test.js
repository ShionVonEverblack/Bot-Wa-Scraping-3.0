'use strict';

/**
 * @fileoverview Unit tests for jobQueue service.
 */

describe('jobQueue', () => {
  let jobQueue;

  beforeEach(() => {
    jest.resetModules();
    jobQueue = require('../../src/jobs/jobQueue');
  });

  afterEach(async () => {
    if (jobQueue) {
      await jobQueue.shutdown();
    }
  });

  describe('enqueue and execution', () => {
    test('enqueues and executes a task successfully', async () => {
      let executed = false;
      const result = await jobQueue.enqueue('job-1', async (signal) => {
        expect(signal).toBeDefined();
        expect(signal.aborted).toBe(false);
        executed = true;
        return { success: true, data: 123 };
      });

      expect(executed).toBe(true);
      expect(result).toEqual({ success: true, data: 123 });
    });

    test('propagates task error if taskFn rejects', async () => {
      const failingTask = jobQueue.enqueue('job-fail', async () => {
        throw new Error('Task internal failure');
      });

      await expect(failingTask).rejects.toThrow('Task internal failure');
    });

    test('getStats reflects accurate initial and post-run counts', async () => {
      const initialStats = jobQueue.getStats();
      expect(initialStats).toEqual({ running: 0, queued: 0 });

      await jobQueue.enqueue('job-stat', async () => {
        const duringStats = jobQueue.getStats();
        expect(duringStats.running).toBeGreaterThanOrEqual(1);
        return 'done';
      });

      const afterStats = jobQueue.getStats();
      expect(afterStats.running).toBe(0);
      expect(afterStats.queued).toBe(0);
    });
  });

  describe('cancellation', () => {
    test('cancel returns false for unknown jobId', () => {
      expect(jobQueue.cancel('non-existent-job')).toBe(false);
    });

    test('cancel signals abort to running task', async () => {
      let wasAborted = false;

      const promise = jobQueue.enqueue('job-cancel-running', async (signal) => {
        return new Promise((resolve) => {
          let timer;
          signal.addEventListener('abort', () => {
            if (timer) clearTimeout(timer);
            wasAborted = true;
            resolve('aborted-gracefully');
          });
          // simulate async work
          timer = setTimeout(() => resolve('completed'), 500);
          if (timer.unref) timer.unref();
        });
      });

      // allow queue schedule tick
      await new Promise((r) => setTimeout(r, 50));
      const cancelled = jobQueue.cancel('job-cancel-running');
      expect(cancelled).toBe(true);

      const result = await promise;
      expect(wasAborted).toBe(true);
      expect(result).toBe('aborted-gracefully');
    });

    test('cancelling before task execution throws JOB_CANCELLED', async () => {
      // Enqueue job and immediately cancel it synchronously before scheduler runs task
      const promise = jobQueue.enqueue('job-cancel-early', async () => {
        return 'should-not-reach';
      });

      const cancelSuccess = jobQueue.cancel('job-cancel-early');
      expect(cancelSuccess).toBe(true);

      await expect(promise).rejects.toMatchObject({
        code: 'JOB_CANCELLED',
      });
    });
  });

  describe('shutdown', () => {
    test('shutdown aborts active jobs and clears queue state', async () => {
      let aborted = false;

      const promise = jobQueue.enqueue('job-shutdown', async (signal) => {
        return new Promise((resolve) => {
          let timer;
          signal.addEventListener('abort', () => {
            if (timer) clearTimeout(timer);
            aborted = true;
            resolve('shutdown-aborted');
          });
          timer = setTimeout(() => resolve('done'), 1000);
          if (timer.unref) timer.unref();
        });
      });

      await new Promise((r) => setTimeout(r, 50));
      await jobQueue.shutdown();

      const stats = jobQueue.getStats();
      expect(stats.running).toBe(0);
      expect(stats.queued).toBe(0);

      const result = await promise;
      expect(aborted).toBe(true);
      expect(result).toBe('shutdown-aborted');
    });
  });

  describe('timeout handling', () => {
    test('throws JOB_TIMEOUT when task exceeds configured jobTimeoutMs', async () => {
      jest.resetModules();
      jest.mock('../../src/config', () => {
        const actual = jest.requireActual('../../src/config');
        return {
          ...actual,
          limits: {
            ...actual.limits,
            jobTimeoutMs: 100, // 100ms timeout
          },
        };
      });

      const shortTimeoutQueue = require('../../src/jobs/jobQueue');

      const timeoutPromise = shortTimeoutQueue.enqueue('job-timeout', async (signal) => {
        return new Promise((resolve, reject) => {
          let timer;
          signal.addEventListener('abort', () => {
            if (timer) clearTimeout(timer);
            const err = new Error('Aborted by timeout');
            err.code = 'ABORTED';
            reject(err);
          });
          timer = setTimeout(() => resolve('done'), 500);
          if (timer.unref) timer.unref();
        });
      });

      await expect(timeoutPromise).rejects.toMatchObject({
        code: 'JOB_TIMEOUT',
      });

      await shortTimeoutQueue.shutdown();
    });
  });
});
