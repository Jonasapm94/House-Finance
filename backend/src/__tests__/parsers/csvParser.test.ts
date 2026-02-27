import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCSV } from '../../parsers/csvParser';
import type { CSVColumnMapping } from '../../parsers/csvParser';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

const defaultMapping: CSVColumnMapping = {
  date: 'Date',
  amount: 'Amount',
  description: 'Description',
  type: 'Type',
};

describe('CSV Parser', () => {
  it('should parse a valid CSV file with standard columns', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.csv'), 'utf-8');
    const transactions = parseCSV(content, defaultMapping);

    expect(transactions).toHaveLength(5);
  });

  it('should correctly parse income transactions', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.csv'), 'utf-8');
    const transactions = parseCSV(content, defaultMapping);

    const salary = transactions.find((t) =>
      t.description.includes('Salary'),
    );
    expect(salary).toBeDefined();
    expect(salary!.amount).toBe(5000.0);
    expect(salary!.type).toBe('income');
    expect(salary!.date).toBe('2024-01-05');
  });

  it('should correctly parse expense transactions', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.csv'), 'utf-8');
    const transactions = parseCSV(content, defaultMapping);

    const grocery = transactions.find((t) =>
      t.description.includes('Supermarket'),
    );
    expect(grocery).toBeDefined();
    expect(grocery!.amount).toBe(150.75);
    expect(grocery!.type).toBe('expense');
  });

  it('should generate deterministic external_ids', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.csv'), 'utf-8');
    const first = parseCSV(content, defaultMapping);
    const second = parseCSV(content, defaultMapping);

    expect(first.map((t) => t.external_id)).toEqual(
      second.map((t) => t.external_id),
    );
  });

  it('should generate unique external_ids for different transactions', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.csv'), 'utf-8');
    const transactions = parseCSV(content, defaultMapping);

    const ids = new Set(transactions.map((t) => t.external_id));
    expect(ids.size).toBe(transactions.length);
  });

  it('should handle Brazilian date format (DD/MM/YYYY)', () => {
    const content = readFileSync(
      join(FIXTURES_DIR, 'sample_br.csv'),
      'utf-8',
    );
    const brMapping: CSVColumnMapping = {
      date: 'Data',
      amount: 'Valor',
      description: 'Descricao',
    };
    const transactions = parseCSV(content, brMapping);

    expect(transactions).toHaveLength(3);
    expect(transactions[0]!.date).toBe('2024-01-05');
  });

  it('should handle Brazilian amount format (1.000,00)', () => {
    const content = readFileSync(
      join(FIXTURES_DIR, 'sample_br.csv'),
      'utf-8',
    );
    const brMapping: CSVColumnMapping = {
      date: 'Data',
      amount: 'Valor',
      description: 'Descricao',
    };
    const transactions = parseCSV(content, brMapping);

    const salary = transactions.find((t) =>
      t.description.includes('Salario'),
    );
    expect(salary).toBeDefined();
    expect(salary!.amount).toBe(5000.0);
    expect(salary!.type).toBe('income');
  });

  it('should determine type from amount sign when type column is absent', () => {
    const content = readFileSync(
      join(FIXTURES_DIR, 'sample_br.csv'),
      'utf-8',
    );
    const brMapping: CSVColumnMapping = {
      date: 'Data',
      amount: 'Valor',
      description: 'Descricao',
    };
    const transactions = parseCSV(content, brMapping);

    const expense = transactions.find((t) =>
      t.description.includes('Supermercado'),
    );
    expect(expense!.type).toBe('expense');

    const income = transactions.find((t) =>
      t.description.includes('Salario'),
    );
    expect(income!.type).toBe('income');
  });

  it('should skip rows with missing required fields', () => {
    const csv = `Date,Description,Amount
2024-01-01,Valid,-100.00
2024-01-02,,-50.00
,Missing Date,-50.00
2024-01-03,No Amount,`;
    const mapping: CSVColumnMapping = {
      date: 'Date',
      amount: 'Amount',
      description: 'Description',
    };
    const transactions = parseCSV(csv, mapping);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.description).toBe('Valid');
  });

  it('should prefix CSV external_ids with csv-', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.csv'), 'utf-8');
    const transactions = parseCSV(content, defaultMapping);

    transactions.forEach((t) => {
      expect(t.external_id).toMatch(/^csv-[a-f0-9]{16}$/);
    });
  });
});
