import OpenAI from 'openai';
import { Category } from '../models/Category';
import { CategorizationRule } from '../models/CategorizationRule';
import { Transaction } from '../models/Transaction';

export interface AiSuggestionInput {
  transaction_id: number;
  suggested_category_id: number;
  rule_pattern: string;
  explanation: string;
}

export interface AiSuggestion extends AiSuggestionInput {
  description: string;
}

export interface AiSuggestResult {
  suggestions: AiSuggestion[];
  skipped: number;
}

export interface AiApplyResult {
  categorized: number;
  rules_created: number;
  skipped: number;
}

interface AiCategorizationItem {
  transaction_id: number;
  suggested_category_id: number;
  rule_pattern: string;
  explanation: string;
}

interface AiResponseBody {
  categorizations: AiCategorizationItem[];
}

const SYSTEM_PROMPT = `You are a financial transaction categorizer for a Brazilian bank account.
You will receive a list of bank transactions and a list of valid categories.
Your task is to assign each transaction to the most appropriate category.

Rules:
- Only include transactions you are confident about — omit any you cannot categorize
- For rule_pattern: extract the shortest reusable lowercase substring that identifies the merchant or transaction type
  Examples: "PAGAMENTO NETFLIX 08/25" → rule_pattern "netflix", "TRF PIX JOAO SILVA" → rule_pattern "trf pix"
- explanation: brief Portuguese explanation of why you chose this category
- Respond ONLY with valid JSON matching: { "categorizations": [{ "transaction_id": number, "suggested_category_id": number, "rule_pattern": string, "explanation": string }] }`;

function getClient(): OpenAI {
  if (!process.env.AI_API_KEY) {
    throw new Error('AI_API_KEY is not configured');
  }
  return new OpenAI({
    baseURL: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
  });
}

const AI_MODEL = () => process.env.AI_MODEL ?? 'gpt-4o-mini';

export class AiCategorizationService {
  static async suggestCategorizations(batchSize = 50): Promise<AiSuggestResult> {
    const uncategorized = await Transaction.query()
      .whereNull('category_id')
      .limit(batchSize)
      .orderBy('date', 'desc');

    if (uncategorized.length === 0) {
      return { suggestions: [], skipped: 0 };
    }

    const categories = await Category.query().orderBy('name');
    if (categories.length === 0) {
      return { suggestions: [], skipped: uncategorized.length };
    }

    const client = getClient();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const transactionLines = uncategorized
      .map((t) => `[${t.id}] ${t.description}`)
      .join('\n');
    const categoryLines = categories.map((c) => `${c.id}: ${c.name}`).join('\n');

    const userMessage = `Transactions:\n${transactionLines}\n\nCategories:\n${categoryLines}`;

    let responseText: string;
    try {
      const response = await client.chat.completions.create({
        model: AI_MODEL(),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      responseText = response.choices[0]?.message?.content ?? '{"categorizations":[]}';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AI service error: ${message}`);
    }

    let parsed: AiResponseBody;
    try {
      parsed = JSON.parse(responseText) as AiResponseBody;
    } catch {
      return { suggestions: [], skipped: uncategorized.length };
    }

    const items = Array.isArray(parsed?.categorizations) ? parsed.categorizations : [];

    const txnIds = new Set(uncategorized.map((t) => t.id));
    const txnMap = new Map(uncategorized.map((t) => [t.id, t]));

    const suggestions: AiSuggestion[] = items
      .filter(
        (item) =>
          txnIds.has(item.transaction_id) && categoryMap.has(item.suggested_category_id),
      )
      .map((item) => ({
        transaction_id: item.transaction_id,
        description: txnMap.get(item.transaction_id)!.description,
        suggested_category_id: item.suggested_category_id,
        rule_pattern: item.rule_pattern.toLowerCase(),
        explanation: item.explanation,
      }));

    return {
      suggestions,
      skipped: uncategorized.length - suggestions.length,
    };
  }

  static async applySuggestions(suggestions: AiSuggestionInput[]): Promise<AiApplyResult> {
    let categorized = 0;
    let rules_created = 0;
    let skipped = 0;

    for (const suggestion of suggestions) {
      try {
        const pattern = suggestion.rule_pattern.toLowerCase();

        const existingRule = await CategorizationRule.query()
          .where('pattern', pattern)
          .where('category_id', suggestion.suggested_category_id)
          .where('match_type', 'substring')
          .first();

        if (!existingRule) {
          await CategorizationRule.query().insert({
            category_id: suggestion.suggested_category_id,
            pattern,
            match_type: 'substring',
            priority: 0,
          });
          rules_created++;
        }

        await Transaction.query()
          .findById(suggestion.transaction_id)
          .patch({ category_id: suggestion.suggested_category_id });

        categorized++;
      } catch (err) {
        console.warn(
          `Failed to apply AI suggestion for transaction ${suggestion.transaction_id}:`,
          err,
        );
        skipped++;
      }
    }

    return { categorized, rules_created, skipped };
  }
}
