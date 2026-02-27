import Papa from 'papaparse';
import { createHash } from 'crypto';
import type { ParsedTransaction } from './ofxParser';

export interface CSVColumnMapping {
  date: string;
  amount: string;
  description: string;
  type?: string; // Optional: column name for income/expense
  external_id?: string; // Optional: column name for dedup identifier (e.g. UUID)
}

/**
 * Parse a CSV file with configurable column mapping.
 * Returns ParsedTransaction[] — same format as the OFX parser.
 */
export function parseCSV(
  content: string,
  mapping: CSVColumnMapping,
): ParsedTransaction[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    const criticalErrors = result.errors.filter(
      (e) => e.type !== 'FieldMismatch',
    );
    if (criticalErrors.length > 0) {
      throw new Error(
        `CSV parsing error: ${criticalErrors[0]!.message}`,
      );
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data as Record<string, string>[]) {
    const parsed = mapCSVRow(row, mapping);
    if (parsed) {
      transactions.push(parsed);
    }
  }

  return transactions;
}

function mapCSVRow(
  row: Record<string, string>,
  mapping: CSVColumnMapping,
): ParsedTransaction | null {
  const dateStr = (row[mapping.date] || '').trim();
  const amountStr = (row[mapping.amount] || '').trim();
  const description = (row[mapping.description] || '').trim();

  if (!dateStr || !amountStr || !description) {
    return null;
  }

  const amount = parseCSVAmount(amountStr);
  if (isNaN(amount) || amount === 0) {
    return null;
  }

  const date = parseCSVDate(dateStr);
  if (!date) {
    return null;
  }

  // Determine type from explicit column or from amount sign
  let type: 'income' | 'expense';
  if (mapping.type && row[mapping.type]) {
    const typeVal = row[mapping.type]!.trim().toLowerCase();
    type =
      typeVal === 'income' ||
      typeVal === 'credit' ||
      typeVal === 'deposit' ||
      typeVal === 'c'
        ? 'income'
        : 'expense';
  } else {
    type = amount > 0 ? 'income' : 'expense';
  }

  // Use explicit external_id column if mapped, otherwise generate a hash
  let externalId: string;
  if (mapping.external_id && row[mapping.external_id]) {
    externalId = row[mapping.external_id]!.trim();
  } else {
    externalId = generateCSVExternalId(date, amount, description);
  }

  return {
    external_id: externalId,
    date,
    amount: Math.abs(amount),
    description,
    type,
  };
}

/**
 * Parse amount strings that may contain currency symbols, commas, etc.
 * Handles: "$1,234.56", "1.234,56" (BR format), "-100.00", "(100.00)"
 */
function parseCSVAmount(amountStr: string): number {
  // Remove currency symbols and spaces
  let cleaned = amountStr.replace(/[R$€£¥\s]/g, '');

  // Handle parentheses as negative: (100.00) → -100.00
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Detect format: if last separator is comma and has 2-3 digits after → BR format
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Brazilian format: 1.234,56 → remove dots, replace comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56 → remove commas
    cleaned = cleaned.replace(/,/g, '');
  }

  return parseFloat(cleaned);
}

/**
 * Parse various date formats into YYYY-MM-DD.
 * Supports: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD
 */
function parseCSVDate(dateStr: string): string | null {
  // Try ISO format first: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try DD/MM/YYYY (common in Brazil)
  const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1]!;
    const month = dmyMatch[2]!;
    const year = dmyMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  // Try YYYY/MM/DD
  const ymdMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Fallback: try Date constructor
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]!;
  }

  return null;
}

/**
 * Generate a deterministic external_id for CSV rows to enable dedup.
 * Uses a hash of date + amount + description.
 */
function generateCSVExternalId(
  date: string,
  amount: number,
  description: string,
): string {
  const payload = `csv:${date}:${amount}:${description}`;
  return `csv-${createHash('sha256').update(payload).digest('hex').substring(0, 16)}`;
}
