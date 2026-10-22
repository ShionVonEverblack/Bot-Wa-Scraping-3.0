'use strict';

const { friendlyError } = require('../../src/utils/errorMessages');

describe('errorMessages', () => {
  test('maps ECONNRESET error code', () => {
    const err = new Error('socket hang up');
    err.code = 'ECONNRESET';
    expect(friendlyError(err)).toContain('Koneksi ke server terputus');
  });

  test('maps HTTP 429 from status code in message', () => {
    const err = new Error('Request failed with status code 429');
    expect(friendlyError(err)).toContain('Terlalu banyak request');
  });

  test('maps ETIMEDOUT keyword in message', () => {
    const err = new Error('connect ETIMEDOUT 192.168.1.1:443');
    expect(friendlyError(err)).toContain('timeout');
  });

  test('maps JOB_CANCELLED code', () => {
    const err = new Error('Cancelled');
    err.code = 'JOB_CANCELLED';
    expect(friendlyError(err)).toContain('dibatalkan');
  });

  test('returns generic message for unknown errors', () => {
    const err = new Error('something weird happened');
    const result = friendlyError(err);
    expect(result).toContain('something weird happened');
  });

  test('truncates very long error messages', () => {
    const err = new Error('x'.repeat(200));
    const result = friendlyError(err);
    expect(result).toContain('Coba lagi nanti');
  });

  test('handles null/undefined input', () => {
    expect(friendlyError(null)).toContain('error');
    expect(friendlyError(undefined)).toContain('error');
  });

  test('handles string input', () => {
    expect(friendlyError('ECONNREFUSED')).toContain('Server tidak merespon');
  });
});
