'use strict';

/**
 * @fileoverview Tests for logger.
 */

const { createLogger } = require('../../src/services/monitor/logger');

describe('logger', () => {
  let stdoutSpy;
  let stderrSpy;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  test('creates logger with all methods', () => {
    const logger = createLogger('test');
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.fatal).toBeDefined();
  });

  test('fatal method logs to stderr', () => {
    const logger = createLogger('test:fatal');
    logger.fatal('A fatal error occurred', { code: 500 });
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls[0][0];
    expect(output).toContain('[FATAL]');
    expect(output).toContain('A fatal error occurred');
    expect(output).toContain('{"code":500}');
  });
});
