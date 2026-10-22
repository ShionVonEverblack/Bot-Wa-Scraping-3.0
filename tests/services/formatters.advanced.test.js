'use strict';

/**
 * @fileoverview Tests for formatAndSave and toExcel — file output functions.
 */

const path = require('path');
const fs = require('fs');

// Use a temp directory inside the project for tests
const TEST_OUTPUT_DIR = path.join(__dirname, '..', '..', '.test_tmp_output');

const SAMPLE_ITEMS = [
  { title: 'Deep Learning', url: 'https://example.com/1', authors: 'LeCun et al.', year: 2015 },
  { title: 'Machine Learning', url: 'https://example.com/2', authors: 'Mitchell', year: 1997 },
  { title: 'Neural Networks', url: 'https://example.com/3', authors: 'Haykin', year: 2009 },
];

const SAMPLE_META = { keyword: 'machine learning', providerUsed: 'test-provider' };

// Mock config so dirs.outputs is writable (actual config is frozen)
jest.mock('../../src/config', () => {
  const actual = jest.requireActual('../../src/config');
  return {
    ...actual,
    dirs: {
      ...actual.dirs,
      outputs: __dirname + '/../../.test_tmp_output',
    },
  };
});

const { toExcel, formatAndSave } = require('../../src/services/formatters');

beforeAll(async () => {
  await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
});

describe('toExcel', () => {
  test('creates an xlsx file', async () => {
    const filepath = await toExcel(SAMPLE_ITEMS, SAMPLE_META, TEST_OUTPUT_DIR);

    expect(filepath).toContain('.xlsx');
    expect(filepath).toContain('machine_learning');

    const stat = await fs.promises.stat(filepath);
    expect(stat.size).toBeGreaterThan(0);
  });

  test('Excel file contains correct data', async () => {
    const filepath = await toExcel(SAMPLE_ITEMS, SAMPLE_META, TEST_OUTPUT_DIR);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);

    const sheet = workbook.getWorksheet('Results');
    expect(sheet).toBeDefined();
    expect(sheet.rowCount).toBe(4); // header + 3 rows

    const headerRow = sheet.getRow(1);
    expect(headerRow.getCell(1).value).toBe('title');
    expect(headerRow.getCell(2).value).toBe('url');

    const firstDataRow = sheet.getRow(2);
    expect(firstDataRow.getCell(1).value).toBe('Deep Learning');
  });

  test('handles empty items', async () => {
    const filepath = await toExcel([], SAMPLE_META, TEST_OUTPUT_DIR);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const sheet = workbook.getWorksheet('Results');
    expect(sheet.getRow(1).getCell(1).value).toBe('No data');
  });

  test('header row is styled bold', async () => {
    const filepath = await toExcel(SAMPLE_ITEMS, SAMPLE_META, TEST_OUTPUT_DIR);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const sheet = workbook.getWorksheet('Results');

    const headerCell = sheet.getRow(1).getCell(1);
    expect(headerCell.font.bold).toBe(true);
  });

  test('sanitizes keyword for filename', async () => {
    const filepath = await toExcel(SAMPLE_ITEMS, { keyword: 'test@#$%^&*()' }, TEST_OUTPUT_DIR);
    const basename = path.basename(filepath);
    expect(basename).not.toMatch(/[@#$%^&*()]/);
    expect(basename).toContain('test');
  });

  test('handles null values and empty meta', async () => {
    const itemsWithNull = [{ title: null, url: undefined, authors: '', year: 2020 }];
    const filepath = await toExcel(itemsWithNull, undefined, TEST_OUTPUT_DIR);
    expect(filepath).toContain('results_'); // Default keyword
    
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const sheet = workbook.getWorksheet('Results');
    const dataRow = sheet.getRow(2);
    expect(dataRow.getCell(1).value).toBeFalsy(); // null -> empty string
  });
});

describe('formatAndSave', () => {
  test('saves JSON format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'json', SAMPLE_META);

    expect(result.filepath).toContain('.json');
    expect(result.content).toBeDefined();

    const parsed = JSON.parse(result.content);
    expect(parsed.data).toHaveLength(3);
    expect(parsed.count).toBe(3);

    const exists = await fs.promises.access(result.filepath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('saves CSV format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'csv', SAMPLE_META);

    expect(result.filepath).toContain('.csv');
    expect(result.content).toContain('title,url,authors,year');

    const lines = result.content.split('\n');
    expect(lines).toHaveLength(4);
  });

  test('saves TSV format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'tsv', SAMPLE_META);
    expect(result.filepath).toContain('.tsv');
    expect(result.content).toContain('\t');
  });

  test('saves HTML format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'html', SAMPLE_META);
    expect(result.filepath).toContain('.html');
    expect(result.content).toContain('<!DOCTYPE html>');
    expect(result.content).toContain('machine learning');
    expect(result.content).toContain('<table>');
  });

  test('saves SQL format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'sql', SAMPLE_META);
    expect(result.filepath).toContain('.sql');
    expect(result.content).toContain('CREATE TABLE');
    expect(result.content).toContain('INSERT INTO');
  });

  test('saves TXT format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'txt', SAMPLE_META);
    expect(result.filepath).toContain('.txt');
    expect(result.content).toContain('=== machine learning ===');
    expect(result.content).toContain('[1] Deep Learning');
  });

  test('saves Excel format (returns filepath, no content)', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'excel', SAMPLE_META);
    expect(result.filepath).toContain('.xlsx');
    expect(result.content).toBeNull();

    const stat = await fs.promises.stat(result.filepath);
    expect(stat.size).toBeGreaterThan(0);
  });

  test('defaults to JSON for unknown format', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'unknown_format', SAMPLE_META);
    expect(result.filepath).toContain('.json');

    const parsed = JSON.parse(result.content);
    expect(parsed.data).toHaveLength(3);
  });

  test('sanitizes keyword in filename', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'csv', { keyword: 'test <data> 123' });
    const basename = path.basename(result.filepath);
    expect(basename).not.toMatch(/[<>]/);
  });

  test('handles empty meta defaults', async () => {
    const result = await formatAndSave(SAMPLE_ITEMS, 'json', undefined);
    expect(result.filepath).toContain('results_'); // Default keyword
    expect(result.content).toBeDefined();
  });
});
