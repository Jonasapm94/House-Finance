import { Transaction } from '../models/Transaction';
import { ImportLog } from '../models/ImportLog';
import { parseOFX, parseCSV } from '../parsers';
import type { ParsedTransaction, CSVColumnMapping } from '../parsers';
import { CategorizationService } from './CategorizationService';

export interface ImportResult {
  filename: string;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  categorizedCount: number;
}

export class ImportService {
  /**
   * Import transactions from a file buffer.
   * Handles deduplication via external_id and auto-categorization.
   */
  static async importFile(
    filename: string,
    content: string,
    fileType: 'ofx' | 'csv',
    csvMapping?: CSVColumnMapping,
  ): Promise<ImportResult> {
    // 1. Parse
    let parsed: ParsedTransaction[];
    if (fileType === 'ofx') {
      parsed = parseOFX(content);
    } else {
      if (!csvMapping) {
        throw new Error('CSV column mapping is required for CSV files');
      }
      parsed = parseCSV(content, csvMapping);
    }

    const totalCount = parsed.length;

    // 2. Deduplicate — find which external_ids already exist
    const externalIds = parsed
      .map((t) => t.external_id)
      .filter(Boolean) as string[];

    const existingIds = new Set<string>();
    if (externalIds.length > 0) {
      const existing = await Transaction.query()
        .whereIn('external_id', externalIds)
        .select('external_id');
      for (const row of existing) {
        if (row.external_id) {
          existingIds.add(row.external_id);
        }
      }
    }

    // Filter out duplicates
    const newTransactions = parsed.filter(
      (t) => !t.external_id || !existingIds.has(t.external_id),
    );
    const duplicateCount = totalCount - newTransactions.length;

    // 3. Prepare for insertion
    const toInsert = newTransactions.map((t) => ({
      external_id: t.external_id,
      date: t.date,
      amount: t.amount.toString(),
      description: t.description,
      type: t.type,
      source: fileType,
      category_id: null as number | null,
    }));

    // 4. Auto-categorize
    const { categorizedCount } =
      await CategorizationService.categorizeTransactions(toInsert);

    // 5. Insert in batches
    if (toInsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        await Transaction.query().insert(batch);
      }
    }

    // 6. Log import
    await ImportLog.query().insert({
      filename,
      total_count: totalCount,
      new_count: newTransactions.length,
      duplicate_count: duplicateCount,
      categorized_count: categorizedCount,
    });

    return {
      filename,
      totalCount,
      newCount: newTransactions.length,
      duplicateCount,
      categorizedCount,
    };
  }
}
