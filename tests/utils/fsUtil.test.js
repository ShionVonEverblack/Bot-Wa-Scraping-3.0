'use strict';

/**
 * @fileoverview Tests for fsUtil — file system utility helpers.
 */

const path = require('path');
const fs = require('fs');
const { ensureDir, writeJson, writeFile, readJson, fileExists, dirSize } = require('../../src/utils/fsUtil');

// Use a temp directory inside the project for tests
const TEST_DIR = path.join(__dirname, '..', '..', '.test_tmp_fs');

// Cleanup before and after all tests
beforeAll(async () => {
  await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
});

describe('fsUtil', () => {
  describe('ensureDir', () => {
    test('creates a directory that does not exist', async () => {
      const dir = path.join(TEST_DIR, 'new_dir');
      await ensureDir(dir);
      const stat = await fs.promises.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });

    test('creates nested directories recursively', async () => {
      const dir = path.join(TEST_DIR, 'a', 'b', 'c');
      await ensureDir(dir);
      const stat = await fs.promises.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });

    test('does not throw if directory already exists', async () => {
      const dir = path.join(TEST_DIR, 'existing');
      await ensureDir(dir);
      await expect(ensureDir(dir)).resolves.not.toThrow();
    });
  });

  describe('writeJson / readJson', () => {
    test('writes and reads JSON correctly', async () => {
      const filepath = path.join(TEST_DIR, 'test.json');
      const data = { name: 'Rima', version: 3, items: [1, 2, 3] };
      await writeJson(filepath, data);

      const result = await readJson(filepath);
      expect(result).toEqual(data);
    });

    test('writes pretty-printed JSON', async () => {
      const filepath = path.join(TEST_DIR, 'pretty.json');
      await writeJson(filepath, { key: 'value' });

      const raw = await fs.promises.readFile(filepath, 'utf-8');
      expect(raw).toContain('\n');  // Pretty-printed has newlines
      expect(raw).toContain('  ');  // 2-space indent
    });

    test('readJson returns null for non-existent file', async () => {
      const result = await readJson(path.join(TEST_DIR, 'nonexistent.json'));
      expect(result).toBeNull();
    });

    test('readJson returns null for invalid JSON', async () => {
      const filepath = path.join(TEST_DIR, 'bad.json');
      await fs.promises.writeFile(filepath, 'not valid json {{{', 'utf-8');
      const result = await readJson(filepath);
      expect(result).toBeNull();
    });

    test('writeJson creates parent directories', async () => {
      const filepath = path.join(TEST_DIR, 'sub', 'dir', 'data.json');
      await writeJson(filepath, { ok: true });
      const result = await readJson(filepath);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('writeFile', () => {
    test('writes string content', async () => {
      const filepath = path.join(TEST_DIR, 'text.txt');
      await writeFile(filepath, 'Hello Rima');
      const content = await fs.promises.readFile(filepath, 'utf-8');
      expect(content).toBe('Hello Rima');
    });

    test('writes Buffer content', async () => {
      const filepath = path.join(TEST_DIR, 'binary.bin');
      const buf = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      await writeFile(filepath, buf);
      const result = await fs.promises.readFile(filepath);
      expect(result).toEqual(buf);
    });

    test('creates parent directories', async () => {
      const filepath = path.join(TEST_DIR, 'deep', 'nested', 'file.txt');
      await writeFile(filepath, 'nested content');
      const content = await fs.promises.readFile(filepath, 'utf-8');
      expect(content).toBe('nested content');
    });
  });

  describe('fileExists', () => {
    test('returns true for existing file', async () => {
      const filepath = path.join(TEST_DIR, 'exists.txt');
      await writeFile(filepath, 'I exist');
      expect(await fileExists(filepath)).toBe(true);
    });

    test('returns false for non-existent file', async () => {
      expect(await fileExists(path.join(TEST_DIR, 'nope.txt'))).toBe(false);
    });

    test('returns true for existing directory', async () => {
      await ensureDir(path.join(TEST_DIR, 'dir_check'));
      expect(await fileExists(path.join(TEST_DIR, 'dir_check'))).toBe(true);
    });
  });

  describe('dirSize', () => {
    test('calculates size of files in directory', async () => {
      const dir = path.join(TEST_DIR, 'size_test');
      await ensureDir(dir);
      await fs.promises.writeFile(path.join(dir, 'a.txt'), 'AAAA');  // 4 bytes
      await fs.promises.writeFile(path.join(dir, 'b.txt'), 'BBBBBB');  // 6 bytes

      const size = await dirSize(dir);
      expect(size).toBe(10);
    });

    test('includes subdirectory sizes', async () => {
      const dir = path.join(TEST_DIR, 'size_nested');
      await ensureDir(path.join(dir, 'sub'));
      await fs.promises.writeFile(path.join(dir, 'root.txt'), 'RR');  // 2 bytes
      await fs.promises.writeFile(path.join(dir, 'sub', 'child.txt'), 'CCC');  // 3 bytes

      const size = await dirSize(dir);
      expect(size).toBe(5);
    });

    test('returns 0 for non-existent directory', async () => {
      const size = await dirSize(path.join(TEST_DIR, 'nonexistent_dir'));
      expect(size).toBe(0);
    });

    test('returns 0 for empty directory', async () => {
      const dir = path.join(TEST_DIR, 'empty_dir');
      await ensureDir(dir);
      const size = await dirSize(dir);
      expect(size).toBe(0);
    });
  });
  describe('error handling', () => {
    test('ensureDir throws on error', async () => {
      const spy = jest.spyOn(fs.promises, 'mkdir').mockRejectedValueOnce(new Error('mkdir error'));
      await expect(ensureDir('test')).rejects.toThrow('mkdir error');
      spy.mockRestore();
    });

    test('writeJson throws on error', async () => {
      const spy = jest.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('write error'));
      await expect(writeJson(path.join(TEST_DIR, 'err.json'), {})).rejects.toThrow('write error');
      spy.mockRestore();
    });

    test('writeFile throws on error', async () => {
      const spy = jest.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('write error'));
      await expect(writeFile(path.join(TEST_DIR, 'err.txt'), 'data')).rejects.toThrow('write error');
      spy.mockRestore();
    });

    test('dirSize catches non-ENOENT errors', async () => {
      const dir = path.join(TEST_DIR, 'err_dir');
      await ensureDir(dir);
      const spy = jest.spyOn(fs.promises, 'readdir').mockRejectedValueOnce(new Error('readdir error'));
      const size = await dirSize(dir);
      expect(size).toBe(0); // Should catch and return accumulated total (0)
      spy.mockRestore();
    });
  });
});
