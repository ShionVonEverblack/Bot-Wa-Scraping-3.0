'use strict';

/**
 * @fileoverview Tests for wizard state machine.
 */

const wizard = require('../../src/bot/wizard/wizardStateMachine');

describe('wizardStateMachine', () => {
  const userId = 'test-user-123';

  afterEach(() => {
    wizard.destroy(userId);
  });

  test('start creates session', () => {
    const prompt = wizard.start(userId);
    expect(prompt).toContain('Mau cari apa?');
    expect(wizard.isActive(userId)).toBe(true);
  });

  test('full flow: keyword → type → limit → confirm', () => {
    wizard.start(userId);

    // Step 1: keyword
    let result = wizard.processInput(userId, 'machine learning');
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('Jenis Data');

    // Step 2: type
    result = wizard.processInput(userId, '2'); // papers
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('Berapa Banyak');

    // Step 3: limit
    result = wizard.processInput(userId, '20');
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('Konfirmasi');

    // Step 4: confirm
    result = wizard.processInput(userId, 'ya');
    expect(result.done).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.keyword).toBe('machine learning');
    expect(result.data.type).toBe('papers');
    expect(result.data.limit).toBe(20);
  });

  test('cancel stops wizard', () => {
    wizard.start(userId);
    const result = wizard.processInput(userId, 'batal');
    expect(result.done).toBe(true);
    expect(result.data).toBeNull();
    expect(wizard.isActive(userId)).toBe(false);
  });

  test('invalid input retries same step', () => {
    wizard.start(userId);

    // Empty keyword
    const result = wizard.processInput(userId, '');
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('tidak boleh kosong');
  });

  test('skip defaults limit to 10', () => {
    wizard.start(userId);
    wizard.processInput(userId, 'test keyword');
    wizard.processInput(userId, '1'); // images
    const result = wizard.processInput(userId, 'skip');
    expect(result.done).toBe(false);
    // Should move to confirm step
    expect(result.prompt).toContain('Konfirmasi');
  });

  test('handles invalid type', () => {
    wizard.start(userId);
    wizard.processInput(userId, 'test keyword');
    const result = wizard.processInput(userId, 'invalid_type_abc');
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('angka 1-4');
  });

  test('handles invalid confirm', () => {
    wizard.start(userId);
    wizard.processInput(userId, 'test keyword');
    wizard.processInput(userId, '2');
    wizard.processInput(userId, '20');
    
    const result = wizard.processInput(userId, 'apa aja');
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('Ketik *ya*');
  });

  test('processInput without active session returns done', () => {
    const result = wizard.processInput('unknown-user', 'hello');
    expect(result.done).toBe(true);
    expect(result.data).toBeNull();
  });

  test('handles invalid limit', () => {
    wizard.start(userId);
    wizard.processInput(userId, 'keyword');
    wizard.processInput(userId, '1'); // type
    const result = wizard.processInput(userId, '100'); // limit > 50
    expect(result.done).toBe(false);
    expect(result.prompt).toContain('antara 1-50');
  });

  test('handles negative confirm (no/tidak)', () => {
    wizard.start(userId);
    wizard.processInput(userId, 'test keyword');
    wizard.processInput(userId, '2');
    wizard.processInput(userId, '20');
    
    const result = wizard.processInput(userId, 'tidak');
    expect(result.done).toBe(true);
    expect(result.prompt).toContain('dibatalkan');
    expect(result.data).toBeNull();
  });

  test('expires session after timeout', () => {
    jest.useFakeTimers();
    wizard.start(userId);
    
    expect(wizard.isActive(userId)).toBe(true);
    
    // Advance time by > 2 minutes (120001 ms)
    jest.advanceTimersByTime(120001);
    
    expect(wizard.isActive(userId)).toBe(false);
    jest.useRealTimers();
  });
});
