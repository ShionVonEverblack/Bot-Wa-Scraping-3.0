# Handoff Report: Adversarial Challenge — Milestone 1 (Jobs & Gitignore)

**Agent**: `challenger_m1_1`  
**Roles**: `critic`, `specialist`  
**Parent Conversation ID**: `3c56f1d7-a28a-447e-8d7a-78513c9be8cc`  
**Milestone**: Milestone 1 (Core Restoration & Skills Integration)  
**Date**: 2026-10-22  
**Working Directory**: `C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\teamwork\challenger_m1_1`  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### Observation 1: `.gitignore` Hardening & Source Protection (Validated: PASS)
- Empirically simulated using native git (`git check-ignore -v` and `git status --ignored --porcelain` on initialized test repositories).
- All source subdirectories (`src/jobs/`, `src/cache/`, `src/auth/`, `src/templates/`, `src/reports/`, `src/outputs/`, `src/watches/`) and tests (`tests/jobs/`, `tests/sub/`) are cleanly tracked and staged (`A src/...`) due to root-level anchoring (`/jobs/`, `/cache/`, etc.) and explicit whitelist directives (`!src/**`, `!tests/**`).
- Root runtime directories (`jobs/`, `cache/`, `auth/`, `outputs/`, `reports/`, `watches/`, `templates/`, `coverage/`, `.test_tmp*/`) are correctly ignored (`!! jobs/`, `!! cache/`).
- Sensitive environment files (`.env`, `.env.local`) are ignored; `.env.example` is tracked.

### Observation 2: Vulnerability 1 — `allowList` Security Bypass on Empty/Missing `userId`
- **Location**: `src/jobs/jobManager.js`, lines 81–85:
  ```javascript
  if (Array.isArray(allowList) && allowList.length > 0 && userId && !allowList.some(p => userId.includes(p))) {
    const err = new Error('User is not in allow list');
    err.code = 'ACCESS_DENIED';
    throw err;
  }
  ```
- **Observed Behavior**:
  - When `config.group.allowList = ['authorized_vip@c.us']`, a request with `userId: 'unauthorized_stranger@c.us'` throws `ACCESS_DENIED`.
  - However, when a request omits `userId` or passes `userId: ''`, `userId && !allowList.some(...)` evaluates to falsy (`''`), completely skipping the check!
- **Empirical Proof**:
  - `tests/jobs/jobVulnerabilitiesRepro.test.js` (Test `REPRO 1`):
    ```javascript
    const allowedJob = await jobManager.createJob({
      request: { keyword: 'unauthenticated_exploit' }, // No userId
    });
    expect(allowedJob).toBeDefined();
    expect(allowedJob.status).toBe('PENDING'); // Succeeded!
    ```
  - Executed via `npx jest tests/jobs/jobVulnerabilitiesRepro.test.js`: Passed with exit code 0.

### Observation 3: Vulnerability 2 — State Machine Race Overwrites `CANCELLED` to `COMPLETED`
- **Location**: `src/jobs/jobStore.js` (`updateJob`, lines 96–111) and `src/jobs/jobWorker.js` (line 68).
- **Observed Behavior**:
  - When a user cancels an in-flight job, `jobManager.cancelJob(jobId)` updates the store to `JOB_STATUS.CANCELLED`.
  - When `processScrapeJob` completes its downstream extraction/formatting, line 68 unconditionally calls:
    ```javascript
    const updatedJob = await jobStore.updateJob(jobId, {
      status: JOB_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      ...
    });
    ```
  - Because `jobStore.updateJob` lacks terminal state validation, `COMPLETED` overwrites `CANCELLED`.
  - Furthermore, `jobWorker.js` proceeds to send completion WhatsApp cards and media to the chat even though the job was cancelled.
- **Empirical Proof**:
  - `tests/jobs/jobVulnerabilitiesRepro.test.js` (Test `REPRO 2`):
    ```javascript
    await jobStore.updateJob(job.jobId, { status: JOB_STATUS.CANCELLED });
    const overwritten = await jobStore.updateJob(job.jobId, { status: JOB_STATUS.COMPLETED });
    expect(overwritten.status).toBe(JOB_STATUS.COMPLETED); // CANCELLED was lost!
    ```
  - Verified by direct node execution:
    ```
    Created job: JTaXPj PENDING
    User cancelled job: CANCELLED
    After worker completes: COMPLETED
    ```

### Observation 4: Vulnerability 3 — Running Task Promise Ignores `cancel()`
- **Location**: `src/jobs/jobQueue.js`, lines 62–65:
  ```javascript
  return await Promise.race([
    taskFn(controller.signal),
    timeoutPromise,
  ]);
  ```
- **Observed Behavior**:
  - `timeoutPromise` only rejects after `timeoutMs` (120,000ms).
  - There is no abort promise in `Promise.race`. If `taskFn` is executing an async operation that does not explicitly attach an `abort` event listener to `signal`, calling `jobQueue.cancel(jobId)` triggers the signal and deletes the controller, but the promise does NOT reject. It continues running until the task finishes and resolves with normal return data.
- **Empirical Proof**:
  - `tests/jobs/jobVulnerabilitiesRepro.test.js` (Test `REPRO 3`):
    `jobQueue.cancel('task-ignore-abort')` returned `true`, but `await taskPromise` resolved with `'task_completed_normally'` instead of rejecting with `JOB_CANCELLED`.

### Observation 5: Vulnerability 4 — Queue Pipeline Starvation under Rapid Cancellations
- **Location**: `src/jobs/jobQueue.js`, lines 14–17 and 86–94:
  ```javascript
  const limiter = new Bottleneck({
    maxConcurrent: config.limits?.maxConcurrency || 3,
    minTime: 500,
  });
  ```
- **Observed Behavior**:
  - When `jobQueue.cancel(jobId)` is invoked on a queued task, Bottleneck is not informed. The job remains in Bottleneck's internal queue.
  - Bottleneck dequeues each cancelled job at a rate-limited interval of `minTime: 500ms`.
  - 10 cancelled jobs take **4.55 seconds** to drain; 15 cancelled jobs take **7.5 seconds**.
  - During this drain period, any new legitimate job queued behind them is stalled by `500ms * N_cancelled_jobs`.
- **Empirical Proof**:
  - `tests/jobs/jobVulnerabilitiesRepro.test.js` (Test `REPRO 4`): Enqueuing 5 jobs and immediately cancelling all 5 took 2,279ms to settle due to the 500ms Bottleneck delay on cancelled items.

### Observation 6: Corrupted State Files & High Concurrency Resilience (PASS)
- Tested via `tests/jobs/jobAdversarialStress.test.js` (16 passing tests):
  - 0-byte JSON files, malformed syntax (`{ "jobId": "broken", `), non-object primitives (`"str"`, `12345`, `[]`, `null`), and subdirectories in `jobs/` are safely handled without throwing uncaught exceptions.
  - 50 concurrent job creations created 50 unique collision-free IDs and valid JSON files on disk.
  - 30 parallel `updateJob` calls on a single job updated fields without disk corruption.

---

## 2. Logic Chain

1. From **Observation 1**, `.gitignore` hardening implemented by `worker_m1` is verified to satisfy F06 completely. No source or test files can be accidentally excluded.
2. From **Observation 2**, the boolean expression `userId && !allowList.some(...)` in `jobManager.js:81` assumes that an unauthenticated or anonymous user will always provide a `userId`. Because `userId` is falsy when omitted, the expression evaluates to falsy, creating an authentication bypass where any sender omitting `userId` gains full access to trigger scrape and paper jobs.
3. From **Observation 3**, the lack of state transition validation in `jobStore.updateJob` allows terminal states (`CANCELLED`, `FAILED`) to be overwritten by subsequent updates from in-flight workers. This breaks idempotency, corrupts job history, and leaks WhatsApp completion messages to users who explicitly cancelled their requests.
4. From **Observation 4**, `jobQueue.js` relies entirely on cooperative signal polling by worker tasks. Without an abort-triggered rejection in `Promise.race`, non-cooperative or synchronous tasks cannot be aborted, and the caller cannot distinguish a cancelled task from a completed one.
5. From **Observation 5**, unanchored cancellation in Bottleneck starves the execution queue because `minTime: 500` applies to cancelled jobs as if they were live jobs.
6. Combining Observations 2, 3, 4, and 5, while the core modules load cleanly and pass baseline happy-path tests, the jobs subsystem contains a critical security bypass, a state-machine race condition, and a queue starvation vulnerability. Therefore, changes must be requested before Milestone 1 can be considered complete.

---

## 3. Caveats

- Tests were conducted using Node 18+ and Jest in a local mock and integration environment.
- WhatsApp Web message delivery was tested against client object interfaces (`client.sendMessage`), not against live WhatsApp Web QR sessions.
- In-flight network calls in `jobWorker` and `paperWorker` were stubbed during high-concurrency suites to isolate queue mechanics and prevent external rate-limiting.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

Milestone 1 satisfies the skills extraction, staging, and gitignore hardening requirements (F01–F07). However, adversarial stress testing has empirically uncovered 4 concrete defects in the `src/jobs/` subsystem that must be remediated:

### Required Remediations for `worker_m1`:
1. **Fix AllowList Security Guard** (`src/jobs/jobManager.js`):
   - When `allowList` is non-empty, reject any request where `!userId` or where `!allowList.some(p => userId.includes(p))`.
2. **Implement State Machine Guards** (`src/jobs/jobStore.js`):
   - In `updateJob(jobId, updates)`: Do not allow terminal states (`CANCELLED`, `FAILED`, `COMPLETED`) to be overwritten by `COMPLETED` or `RUNNING`. Specifically, if `job.status === JOB_STATUS.CANCELLED`, ignore transitions to `COMPLETED` or `RUNNING`.
   - In `jobWorker.js` / `paperWorker.js`: Check `(await jobStore.getJob(jobId))?.status !== JOB_STATUS.CANCELLED` before sending WhatsApp messages or marking completed.
3. **Make `jobQueue.enqueue` Abort-Aware** (`src/jobs/jobQueue.js`):
   - Add an abort rejection promise inside `Promise.race`:
     ```javascript
     const abortPromise = new Promise((_, reject) => {
       controller.signal.addEventListener('abort', () => {
         const err = new Error('Job cancelled');
         err.code = 'JOB_CANCELLED';
         reject(err);
       });
     });
     return await Promise.race([taskFn(controller.signal), timeoutPromise, abortPromise]);
     ```
4. **Prevent Queue Starvation in `cancel()`** (`src/jobs/jobQueue.js`):
   - Decrement `queuedCount` immediately upon `cancel(jobId)` if the job has not started running.

---

## 5. Verification Method

To independently verify these findings:

1. **Run Empirical Bug Reproductions Suite (demonstrating all 4 failure modes)**:
   ```powershell
   npx jest tests/jobs/jobVulnerabilitiesRepro.test.js --verbose
   ```
   *Expected*: All 4 reproduction tests pass, verifying the exact presence of the 4 described failure modes.

2. **Run Adversarial Stress Test Suite**:
   ```powershell
   npx jest tests/jobs/jobAdversarialStress.test.js --verbose
   ```
   *Expected*: 16/16 tests pass, validating state corruption resilience, 50-job concurrency, and surface warnings.

3. **Run All Jobs Tests**:
   ```powershell
   npx jest tests/jobs/
   ```
   *Expected*: 5 test suites, 49 tests passing.

4. **Verify Gitignore Protection**:
   ```powershell
   $temp = Join-Path $env:TEMP ("git_chk_" + [Guid]::NewGuid().ToString())
   New-Item -ItemType Directory $temp | Out-Null
   Copy-Item .gitignore $temp
   git -C $temp init | Out-Null
   git -C $temp check-ignore -v src/jobs/jobManager.js # outputs !src/**
   git -C $temp check-ignore -v jobs/test.json         # outputs /jobs/
   Remove-Item -Recurse -Force $temp
   ```
