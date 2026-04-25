import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { aiCategorizationRoutes } from '../../routes/aiCategorization';

// Mock the service entirely
vi.mock('../../services/AiCategorizationService', () => ({
  AiCategorizationService: {
    suggestCategorizations: vi.fn(),
    applySuggestions: vi.fn(),
  },
}));

import { AiCategorizationService } from '../../services/AiCategorizationService';

describe('AI Categorization routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(aiCategorizationRoutes, { prefix: '/api/ai-categorization' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/ai-categorization/suggest', () => {
    it('returns 503 when AI_API_KEY is missing', async () => {
      vi.mocked(AiCategorizationService.suggestCategorizations).mockRejectedValueOnce(
        new Error('AI_API_KEY is not configured'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/suggest',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(true);
    });

    it('returns 502 on AI service error', async () => {
      vi.mocked(AiCategorizationService.suggestCategorizations).mockRejectedValueOnce(
        new Error('AI service error: network timeout'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/suggest',
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(true);
    });

    it('returns 200 with suggestions on success', async () => {
      const mockResult = {
        suggestions: [
          {
            transaction_id: 1,
            description: 'NETFLIX',
            suggested_category_id: 1,
            rule_pattern: 'netflix',
            explanation: 'Streaming',
          },
        ],
        skipped: 0,
      };
      vi.mocked(AiCategorizationService.suggestCategorizations).mockResolvedValueOnce(
        mockResult,
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/suggest',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.suggestions).toHaveLength(1);
      expect(body.skipped).toBe(0);
    });
  });

  describe('POST /api/ai-categorization/apply', () => {
    it('returns 400 when suggestions array is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/apply',
        payload: { suggestions: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when body is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/apply',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 200 with apply result on valid input', async () => {
      vi.mocked(AiCategorizationService.applySuggestions).mockResolvedValueOnce({
        categorized: 1,
        rules_created: 1,
        skipped: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/apply',
        payload: {
          suggestions: [
            {
              transaction_id: 1,
              suggested_category_id: 2,
              rule_pattern: 'netflix',
              explanation: 'Streaming',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.categorized).toBe(1);
      expect(body.rules_created).toBe(1);
    });
  });

  describe('POST /api/ai-categorization/auto', () => {
    it('returns 503 when AI_API_KEY is missing', async () => {
      vi.mocked(AiCategorizationService.suggestCategorizations).mockRejectedValueOnce(
        new Error('AI_API_KEY is not configured'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/auto',
      });

      expect(response.statusCode).toBe(503);
    });

    it('returns 200 with apply result when suggestions exist', async () => {
      vi.mocked(AiCategorizationService.suggestCategorizations).mockResolvedValueOnce({
        suggestions: [
          {
            transaction_id: 1,
            description: 'NETFLIX',
            suggested_category_id: 1,
            rule_pattern: 'netflix',
            explanation: 'Streaming',
          },
        ],
        skipped: 0,
      });
      vi.mocked(AiCategorizationService.applySuggestions).mockResolvedValueOnce({
        categorized: 1,
        rules_created: 1,
        skipped: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/auto',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.categorized).toBe(1);
    });

    it('returns 200 with zeros when no suggestions', async () => {
      vi.mocked(AiCategorizationService.suggestCategorizations).mockResolvedValueOnce({
        suggestions: [],
        skipped: 3,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai-categorization/auto',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.categorized).toBe(0);
      expect(body.skipped).toBe(3);
    });
  });
});
