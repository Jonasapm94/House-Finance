import { describe, it, expect } from 'vitest';
import { CategorizationService } from '../../services/CategorizationService';
import { CategorizationRule } from '../../models/CategorizationRule';

// Create mock rules without DB dependency
function createMockRule(overrides: Partial<CategorizationRule>): CategorizationRule {
  return {
    id: 1,
    category_id: 1,
    pattern: '',
    match_type: 'substring',
    priority: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as CategorizationRule;
}

describe('CategorizationService.findMatchingRule', () => {
  describe('substring matching', () => {
    it('should match when description contains the pattern (case-insensitive)', () => {
      const rules = [
        createMockRule({
          id: 1,
          category_id: 10,
          pattern: 'supermarket',
          match_type: 'substring',
        }),
      ];

      const result = CategorizationService.findMatchingRule(
        'SUPERMARKET GROCERIES',
        rules,
      );
      expect(result).not.toBeNull();
      expect(result!.category_id).toBe(10);
    });

    it('should not match when pattern is not in description', () => {
      const rules = [
        createMockRule({
          pattern: 'pharmacy',
          match_type: 'substring',
        }),
      ];

      const result = CategorizationService.findMatchingRule(
        'SUPERMARKET GROCERIES',
        rules,
      );
      expect(result).toBeNull();
    });

    it('should match partial strings', () => {
      const rules = [
        createMockRule({
          pattern: 'uber',
          match_type: 'substring',
          category_id: 5,
        }),
      ];

      const result = CategorizationService.findMatchingRule(
        'UBER EATS order #123',
        rules,
      );
      expect(result!.category_id).toBe(5);
    });
  });

  describe('exact matching', () => {
    it('should match when description exactly equals the pattern (case-insensitive)', () => {
      const rules = [
        createMockRule({
          pattern: 'salary deposit',
          match_type: 'exact',
          category_id: 20,
        }),
      ];

      const result = CategorizationService.findMatchingRule('Salary Deposit', rules);
      expect(result!.category_id).toBe(20);
    });

    it('should not match partial matches for exact type', () => {
      const rules = [
        createMockRule({
          pattern: 'salary',
          match_type: 'exact',
        }),
      ];

      const result = CategorizationService.findMatchingRule('Salary Deposit', rules);
      expect(result).toBeNull();
    });
  });

  describe('regex matching', () => {
    it('should match when description matches the regex pattern', () => {
      const rules = [
        createMockRule({
          pattern: 'uber\\s+(eats|rides)',
          match_type: 'regex',
          category_id: 30,
        }),
      ];

      const result = CategorizationService.findMatchingRule(
        'UBER EATS order #123',
        rules,
      );
      expect(result!.category_id).toBe(30);
    });

    it('should handle complex regex patterns', () => {
      const rules = [
        createMockRule({
          pattern: '^(PIX|TED|DOC)\\s+',
          match_type: 'regex',
          category_id: 40,
        }),
      ];

      const result = CategorizationService.findMatchingRule(
        'PIX RECEIVED FROM JOHN',
        rules,
      );
      expect(result!.category_id).toBe(40);
    });

    it('should skip invalid regex patterns gracefully', () => {
      const rules = [
        createMockRule({
          pattern: '[invalid',
          match_type: 'regex',
          category_id: 50,
        }),
        createMockRule({
          id: 2,
          pattern: 'fallback',
          match_type: 'substring',
          category_id: 60,
        }),
      ];

      const result = CategorizationService.findMatchingRule('fallback text', rules);
      expect(result!.category_id).toBe(60);
    });
  });

  describe('priority ordering', () => {
    it('should return the first matching rule (rules should be pre-sorted by priority)', () => {
      const rules = [
        createMockRule({
          id: 1,
          pattern: 'uber eats',
          match_type: 'substring',
          category_id: 10,
          priority: 100,
        }),
        createMockRule({
          id: 2,
          pattern: 'uber',
          match_type: 'substring',
          category_id: 20,
          priority: 50,
        }),
      ];

      const result = CategorizationService.findMatchingRule('UBER EATS delivery', rules);
      // First rule in array wins
      expect(result!.category_id).toBe(10);
    });

    it('should return the second rule if first does not match', () => {
      const rules = [
        createMockRule({
          id: 1,
          pattern: 'ifood',
          match_type: 'substring',
          category_id: 10,
          priority: 100,
        }),
        createMockRule({
          id: 2,
          pattern: 'uber',
          match_type: 'substring',
          category_id: 20,
          priority: 50,
        }),
      ];

      const result = CategorizationService.findMatchingRule('UBER EATS delivery', rules);
      expect(result!.category_id).toBe(20);
    });

    it('should return null when no rules match', () => {
      const rules = [
        createMockRule({
          pattern: 'ifood',
          match_type: 'substring',
        }),
        createMockRule({
          id: 2,
          pattern: 'rappi',
          match_type: 'substring',
        }),
      ];

      const result = CategorizationService.findMatchingRule('UBER EATS delivery', rules);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty rules array', () => {
      const result = CategorizationService.findMatchingRule('anything', []);
      expect(result).toBeNull();
    });

    it('should handle empty description', () => {
      const rules = [
        createMockRule({
          pattern: 'test',
          match_type: 'substring',
        }),
      ];

      const result = CategorizationService.findMatchingRule('', rules);
      expect(result).toBeNull();
    });

    it('should handle special characters in substring pattern', () => {
      const rules = [
        createMockRule({
          pattern: 'pix r$',
          match_type: 'substring',
          category_id: 70,
        }),
      ];

      const result = CategorizationService.findMatchingRule(
        'PIX R$500.00 FROM JOHN',
        rules,
      );
      expect(result!.category_id).toBe(70);
    });
  });
});
