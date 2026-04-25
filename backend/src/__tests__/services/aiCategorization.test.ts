import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiCategorizationService } from '../../services/AiCategorizationService';

// Mock the openai module
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  };
});

// Mock models
vi.mock('../../models/Transaction', () => ({
  Transaction: {
    query: vi.fn(),
  },
}));

vi.mock('../../models/Category', () => ({
  Category: {
    query: vi.fn(),
  },
}));

vi.mock('../../models/CategorizationRule', () => ({
  CategorizationRule: {
    query: vi.fn(),
  },
}));

import { Transaction } from '../../models/Transaction';
import { Category } from '../../models/Category';
import { CategorizationRule } from '../../models/CategorizationRule';

function makeQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {
    whereNull: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue({ id: 1 }),
    findById: vi.fn().mockReturnThis(),
    patch: vi.fn().mockResolvedValue(1),
  };
  // Make the chain itself awaitable
  Object.defineProperty(chain, Symbol.asyncIterator, { value: undefined });
  // Allow `await chain` to resolve to result
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe('AiCategorizationService.suggestCategorizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.AI_BASE_URL;
  });

  it('returns empty result when no uncategorized transactions exist', async () => {
    const txnChain = makeQueryChain([]);
    vi.mocked(Transaction.query).mockReturnValue(txnChain as ReturnType<typeof Transaction.query>);

    const result = await AiCategorizationService.suggestCategorizations();

    expect(result).toEqual({ suggestions: [], skipped: 0 });
    expect(Category.query).not.toHaveBeenCalled();
  });

  it('throws when AI_API_KEY is not set', async () => {
    const txns = [{ id: 1, description: 'PGTO NETFLIX', category_id: null }];
    const cats = [{ id: 1, name: 'Streaming' }];

    const txnChain = makeQueryChain(txns);
    vi.mocked(Transaction.query).mockReturnValue(txnChain as ReturnType<typeof Transaction.query>);

    const catChain = makeQueryChain(cats);
    vi.mocked(Category.query).mockReturnValue(catChain as ReturnType<typeof Category.query>);

    await expect(AiCategorizationService.suggestCategorizations()).rejects.toThrow(
      'AI_API_KEY is not configured',
    );
  });

  it('parses AI response and returns valid suggestions', async () => {
    process.env.AI_API_KEY = 'test-key';

    const txns = [
      { id: 1, description: 'PGTO NETFLIX 08/25', category_id: null },
      { id: 2, description: 'COMPRA SUPERMERCADO', category_id: null },
    ];
    const cats = [
      { id: 1, name: 'Streaming' },
      { id: 2, name: 'Alimentação' },
    ];

    const txnChain = makeQueryChain(txns);
    vi.mocked(Transaction.query).mockReturnValue(txnChain as ReturnType<typeof Transaction.query>);

    const catChain = makeQueryChain(cats);
    vi.mocked(Category.query).mockReturnValue(catChain as ReturnType<typeof Category.query>);

    const openaiModule = await import('openai');
    const mockCreate = (
      openaiModule as unknown as { __mockCreate: ReturnType<typeof vi.fn> }
    ).__mockCreate;

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categorizations: [
                {
                  transaction_id: 1,
                  suggested_category_id: 1,
                  rule_pattern: 'netflix',
                  explanation: 'Serviço de streaming Netflix',
                },
                {
                  transaction_id: 2,
                  suggested_category_id: 2,
                  rule_pattern: 'supermercado',
                  explanation: 'Compra em supermercado',
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await AiCategorizationService.suggestCategorizations();

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0]).toMatchObject({
      transaction_id: 1,
      suggested_category_id: 1,
      rule_pattern: 'netflix',
      description: 'PGTO NETFLIX 08/25',
    });
    expect(result.skipped).toBe(0);
  });

  it('drops suggestions with invalid category_id', async () => {
    process.env.AI_API_KEY = 'test-key';

    const txns = [{ id: 1, description: 'PGTO NETFLIX', category_id: null }];
    const cats = [{ id: 1, name: 'Streaming' }];

    const txnChain = makeQueryChain(txns);
    vi.mocked(Transaction.query).mockReturnValue(txnChain as ReturnType<typeof Transaction.query>);

    const catChain = makeQueryChain(cats);
    vi.mocked(Category.query).mockReturnValue(catChain as ReturnType<typeof Category.query>);

    const openaiModule = await import('openai');
    const mockCreate = (
      openaiModule as unknown as { __mockCreate: ReturnType<typeof vi.fn> }
    ).__mockCreate;

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categorizations: [
                {
                  transaction_id: 1,
                  suggested_category_id: 999, // invalid
                  rule_pattern: 'netflix',
                  explanation: 'Streaming',
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await AiCategorizationService.suggestCategorizations();

    expect(result.suggestions).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});

describe('AiCategorizationService.applySuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a rule and patches the transaction when no existing rule', async () => {
    const ruleChain = {
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue({ id: 10 }),
    };
    vi.mocked(CategorizationRule.query).mockReturnValue(
      ruleChain as ReturnType<typeof CategorizationRule.query>,
    );

    const txnChain = {
      findById: vi.fn().mockReturnThis(),
      patch: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(Transaction.query).mockReturnValue(
      txnChain as ReturnType<typeof Transaction.query>,
    );

    const suggestions = [
      {
        transaction_id: 1,
        suggested_category_id: 2,
        rule_pattern: 'netflix',
        explanation: 'streaming',
      },
    ];

    const result = await AiCategorizationService.applySuggestions(suggestions);

    expect(ruleChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: 'netflix', category_id: 2, match_type: 'substring' }),
    );
    expect(txnChain.patch).toHaveBeenCalledWith({ category_id: 2 });
    expect(result).toEqual({ categorized: 1, rules_created: 1, skipped: 0 });
  });

  it('does not create duplicate rule when one already exists', async () => {
    const existingRule = { id: 5, pattern: 'netflix', category_id: 2, match_type: 'substring' };
    const ruleChain = {
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingRule),
      insert: vi.fn(),
    };
    vi.mocked(CategorizationRule.query).mockReturnValue(
      ruleChain as ReturnType<typeof CategorizationRule.query>,
    );

    const txnChain = {
      findById: vi.fn().mockReturnThis(),
      patch: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(Transaction.query).mockReturnValue(
      txnChain as ReturnType<typeof Transaction.query>,
    );

    const suggestions = [
      {
        transaction_id: 1,
        suggested_category_id: 2,
        rule_pattern: 'netflix',
        explanation: 'streaming',
      },
    ];

    const result = await AiCategorizationService.applySuggestions(suggestions);

    expect(ruleChain.insert).not.toHaveBeenCalled();
    expect(txnChain.patch).toHaveBeenCalledWith({ category_id: 2 });
    expect(result).toEqual({ categorized: 1, rules_created: 0, skipped: 0 });
  });

  it('counts skipped on failure and continues processing', async () => {
    let callCount = 0;
    const ruleChain = {
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('DB error');
        return Promise.resolve(null);
      }),
      insert: vi.fn().mockResolvedValue({ id: 1 }),
    };
    vi.mocked(CategorizationRule.query).mockReturnValue(
      ruleChain as ReturnType<typeof CategorizationRule.query>,
    );

    const txnChain = {
      findById: vi.fn().mockReturnThis(),
      patch: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(Transaction.query).mockReturnValue(
      txnChain as ReturnType<typeof Transaction.query>,
    );

    const suggestions = [
      { transaction_id: 1, suggested_category_id: 2, rule_pattern: 'fail', explanation: 'x' },
      { transaction_id: 2, suggested_category_id: 3, rule_pattern: 'ok', explanation: 'y' },
    ];

    const result = await AiCategorizationService.applySuggestions(suggestions);

    expect(result.categorized).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
