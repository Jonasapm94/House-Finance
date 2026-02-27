import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOFX } from '../../parsers/ofxParser';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

describe('OFX Parser', () => {
  it('should parse a valid OFX file with bank transactions', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    expect(transactions).toHaveLength(4);
  });

  it('should correctly parse income transactions (positive amounts)', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    const salary = transactions.find((t) => t.external_id === 'TXN001');
    expect(salary).toBeDefined();
    expect(salary!.amount).toBe(5000.0);
    expect(salary!.type).toBe('income');
    expect(salary!.date).toBe('2024-01-05');
    expect(salary!.description).toContain('SALARY DEPOSIT');
  });

  it('should correctly parse expense transactions (negative amounts)', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    const grocery = transactions.find((t) => t.external_id === 'TXN002');
    expect(grocery).toBeDefined();
    expect(grocery!.amount).toBe(150.75);
    expect(grocery!.type).toBe('expense');
    expect(grocery!.date).toBe('2024-01-10');
    expect(grocery!.description).toContain('SUPERMARKET');
  });

  it('should combine NAME and MEMO into description', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    const salary = transactions.find((t) => t.external_id === 'TXN001');
    expect(salary!.description).toBe('SALARY DEPOSIT Monthly salary');
  });

  it('should use only NAME when MEMO is absent', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    const electricity = transactions.find((t) => t.external_id === 'TXN003');
    expect(electricity!.description).toBe('ELECTRICITY BILL');
  });

  it('should extract unique FITID as external_id', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    const ids = transactions.map((t) => t.external_id);
    expect(ids).toEqual(['TXN001', 'TXN002', 'TXN003', 'TXN004']);
    // All unique
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should parse OFX dates correctly (YYYYMMDD format)', () => {
    const content = readFileSync(join(FIXTURES_DIR, 'sample.ofx'), 'utf-8');
    const transactions = parseOFX(content);

    const dates = transactions.map((t) => t.date);
    expect(dates).toEqual([
      '2024-01-05',
      '2024-01-10',
      '2024-01-15',
      '2024-01-20',
    ]);
  });

  it('should return empty array for content without OFX root', () => {
    expect(() => parseOFX('just some random text')).toThrow(
      'Invalid OFX file',
    );
  });

  it('should return empty array for OFX without transactions', () => {
    const minimalOFX = `
<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
</SONRS>
</SIGNONMSGSRSV1>
</OFX>`;
    const transactions = parseOFX(minimalOFX);
    expect(transactions).toHaveLength(0);
  });

  it('should handle single transaction (not in array)', () => {
    const singleTxnOFX = `
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240101
<TRNAMT>-50.00
<FITID>SINGLE001
<NAME>SINGLE TRANSACTION
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
    const transactions = parseOFX(singleTxnOFX);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.external_id).toBe('SINGLE001');
  });
});
