import { CategorizationRule } from '../models/CategorizationRule';
import { Transaction } from '../models/Transaction';

export interface CategorizationResult {
  categorizedCount: number;
  uncategorizedCount: number;
}

/**
 * Categorizes transactions by matching their descriptions against rules.
 * Uses priority ordering — first match wins.
 */
export class CategorizationService {
  /**
   * Categorize an array of in-memory transactions (before insert).
   * Returns the transactions with category_id set where rules matched.
   */
  static async categorizeTransactions(
    transactions: Array<{
      description: string;
      category_id?: number | null;
    }>,
  ): Promise<CategorizationResult> {
    const rules = await CategorizationRule.query()
      .orderBy('priority', 'desc')
      .orderBy('id', 'asc');

    let categorizedCount = 0;
    let uncategorizedCount = 0;

    for (const txn of transactions) {
      const matchedRule = CategorizationService.findMatchingRule(txn.description, rules);

      if (matchedRule) {
        txn.category_id = matchedRule.category_id;
        categorizedCount++;
      } else {
        uncategorizedCount++;
      }
    }

    return { categorizedCount, uncategorizedCount };
  }

  /**
   * Re-apply all rules to existing uncategorized transactions in the DB.
   */
  static async recategorizeUncategorized(): Promise<CategorizationResult> {
    const rules = await CategorizationRule.query()
      .orderBy('priority', 'desc')
      .orderBy('id', 'asc');

    const uncategorized = await Transaction.query().whereNull('category_id');

    let categorizedCount = 0;

    for (const txn of uncategorized) {
      const matchedRule = CategorizationService.findMatchingRule(txn.description, rules);

      if (matchedRule) {
        await Transaction.query()
          .findById(txn.id)
          .patch({ category_id: matchedRule.category_id });
        categorizedCount++;
      }
    }

    return {
      categorizedCount,
      uncategorizedCount: uncategorized.length - categorizedCount,
    };
  }

  /**
   * Find the first rule that matches a transaction description.
   * Rules are already sorted by priority (desc).
   */
  static findMatchingRule(
    description: string,
    rules: CategorizationRule[],
  ): CategorizationRule | null {
    const lowerDesc = description.toLowerCase();

    for (const rule of rules) {
      switch (rule.match_type) {
        case 'exact':
          if (lowerDesc === rule.pattern.toLowerCase()) {
            return rule;
          }
          break;

        case 'substring':
          if (lowerDesc.includes(rule.pattern.toLowerCase())) {
            return rule;
          }
          break;

        case 'regex':
          try {
            const regex = new RegExp(rule.pattern, 'i');
            if (regex.test(description)) {
              return rule;
            }
          } catch {
            // Invalid regex — skip this rule
          }
          break;
      }
    }

    return null;
  }
}
