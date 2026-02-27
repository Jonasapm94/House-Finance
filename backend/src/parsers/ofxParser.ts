import { XMLParser } from 'fast-xml-parser';

export interface ParsedTransaction {
  external_id: string;
  date: string;
  amount: number;
  description: string;
  type: 'income' | 'expense';
}

/**
 * Parse an OFX file buffer into an array of transactions.
 * OFX files contain SGML-like markup with STMTTRN elements.
 */
export function parseOFX(content: string): ParsedTransaction[] {
  // OFX files are SGML, not proper XML. We need to clean them up first.
  const xmlContent = normalizeOFXToXML(content);

  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);

  // Navigate to the transaction list
  const stmtTrnList = findTransactionList(parsed);
  if (!stmtTrnList) {
    return [];
  }

  // STMTTRN can be a single object or an array
  const rawTransactions = Array.isArray(stmtTrnList.STMTTRN)
    ? stmtTrnList.STMTTRN
    : stmtTrnList.STMTTRN
      ? [stmtTrnList.STMTTRN]
      : [];

  return rawTransactions.map(mapTransaction).filter(Boolean) as ParsedTransaction[];
}

/**
 * OFX files use SGML-like tags without closing tags for leaf elements.
 * We convert them to proper XML for parsing.
 */
function normalizeOFXToXML(content: string): string {
  // Remove OFX headers (everything before the first < tag)
  const xmlStart = content.indexOf('<OFX');
  if (xmlStart === -1) {
    // Try lowercase
    const xmlStartLower = content.indexOf('<ofx');
    if (xmlStartLower === -1) {
      throw new Error('Invalid OFX file: no <OFX> root element found');
    }
    content = content.substring(xmlStartLower);
  } else {
    content = content.substring(xmlStart);
  }

  // Close unclosed SGML tags: lines like "<TAG>value" → "<TAG>value</TAG>"
  const lines = content.split(/\r?\n/);
  const closedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    // Match patterns like "<TAG>value" where value is not another tag
    const match = trimmed.match(/^<(\w+)>([^<]+)$/);
    if (match) {
      const tag = match[1];
      const value = match[2]!.trim();
      return `<${tag}>${value}</${tag}>`;
    }
    return trimmed;
  });

  return closedLines.join('\n');
}

/**
 * Navigate through the parsed OFX structure to find STMTTRNLIST.
 * Handles both bank and credit card statements.
 */
function findTransactionList(
  parsed: Record<string, unknown>,
): Record<string, unknown> | null {
  // Bank statement: OFX > BANKMSGSRSV1 > STMTTRNRS > STMTRS > BANKTRANLIST
  // Credit card:    OFX > CREDITCARDMSGSRSV1 > CCSTMTTRNRS > CCSTMTRS > BANKTRANLIST
  const ofx = (parsed.OFX || parsed.ofx) as Record<string, unknown> | undefined;
  if (!ofx) return null;

  // Try bank statement path
  const bankMsgs = (ofx.BANKMSGSRSV1 || ofx.bankmsgsrsv1) as
    | Record<string, unknown>
    | undefined;
  if (bankMsgs) {
    const stmtTrnRs = (bankMsgs.STMTTRNRS || bankMsgs.stmttrnrs) as
      | Record<string, unknown>
      | undefined;
    if (stmtTrnRs) {
      const stmtRs = (stmtTrnRs.STMTRS || stmtTrnRs.stmtrs) as
        | Record<string, unknown>
        | undefined;
      if (stmtRs) {
        const list = (stmtRs.BANKTRANLIST || stmtRs.banktranlist) as
          | Record<string, unknown>
          | undefined;
        if (list) return list;
      }
    }
  }

  // Try credit card path
  const ccMsgs = (ofx.CREDITCARDMSGSRSV1 || ofx.creditcardmsgsrsv1) as
    | Record<string, unknown>
    | undefined;
  if (ccMsgs) {
    const ccStmtTrnRs = (ccMsgs.CCSTMTTRNRS || ccMsgs.ccstmttrnrs) as
      | Record<string, unknown>
      | undefined;
    if (ccStmtTrnRs) {
      const ccStmtRs = (ccStmtTrnRs.CCSTMTRS || ccStmtTrnRs.ccstmtrs) as
        | Record<string, unknown>
        | undefined;
      if (ccStmtRs) {
        const list = (ccStmtRs.BANKTRANLIST || ccStmtRs.banktranlist) as
          | Record<string, unknown>
          | undefined;
        if (list) return list;
      }
    }
  }

  return null;
}

/**
 * Map a raw OFX transaction element to our ParsedTransaction interface.
 */
function mapTransaction(
  raw: Record<string, unknown>,
): ParsedTransaction | null {
  const fitid = String(raw.FITID || raw.fitid || '').trim();
  const dateStr = String(raw.DTPOSTED || raw.dtposted || '').trim();
  const amountStr = String(raw.TRNAMT || raw.trnamt || '').trim();
  const name = String(raw.NAME || raw.name || '').trim();
  const memo = String(raw.MEMO || raw.memo || '').trim();

  if (!fitid || !dateStr || !amountStr) {
    return null;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) {
    return null;
  }

  // Parse OFX date format: YYYYMMDD or YYYYMMDDHHMMSS
  const date = parseOFXDate(dateStr);
  if (!date) {
    return null;
  }

  const description = memo ? `${name} ${memo}`.trim() : name;

  return {
    external_id: fitid,
    date,
    amount: Math.abs(amount),
    description: description || 'Unknown',
    type: amount >= 0 ? 'income' : 'expense',
  };
}

/**
 * Parse OFX date format YYYYMMDD[HHMMSS[.XXX]] to ISO date string YYYY-MM-DD
 */
function parseOFXDate(dateStr: string): string | null {
  // Remove timezone info like [-3:BRT] or [0:GMT]
  const cleaned = dateStr.replace(/\[.*\]/, '').trim();

  if (cleaned.length < 8) return null;

  const year = cleaned.substring(0, 4);
  const month = cleaned.substring(4, 6);
  const day = cleaned.substring(6, 8);

  // Basic validation
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year}-${month}-${day}`;
}
