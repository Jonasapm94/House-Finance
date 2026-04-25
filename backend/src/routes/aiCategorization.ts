import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AiCategorizationService } from '../services/AiCategorizationService';
import { AiApplyBodySchema } from '../validators/schemas';

export async function aiCategorizationRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /api/ai-categorization/suggest — get suggestions without applying
  app.post('/suggest', async (_request, reply) => {
    try {
      const result = await AiCategorizationService.suggestCategorizations();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('AI_API_KEY')) {
        return reply.status(503).send({
          error: true,
          message: 'AI service not configured. Set AI_API_KEY in environment.',
          statusCode: 503,
        });
      }
      fastify.log.error(err);
      return reply.status(502).send({
        error: true,
        message: 'AI service temporarily unavailable. Please try again.',
        statusCode: 502,
      });
    }
  });

  // POST /api/ai-categorization/apply — apply reviewed suggestions
  app.post(
    '/apply',
    {
      schema: {
        body: AiApplyBodySchema,
      },
    },
    async (request) => {
      const { suggestions } = request.body;
      return AiCategorizationService.applySuggestions(suggestions);
    },
  );

  // POST /api/ai-categorization/auto — suggest + apply in one step
  app.post('/auto', async (_request, reply) => {
    try {
      const { suggestions, skipped } = await AiCategorizationService.suggestCategorizations();

      if (suggestions.length === 0) {
        return { categorized: 0, rules_created: 0, skipped };
      }

      const result = await AiCategorizationService.applySuggestions(suggestions);
      return { ...result, skipped: result.skipped + skipped };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('AI_API_KEY')) {
        return reply.status(503).send({
          error: true,
          message: 'AI service not configured. Set AI_API_KEY in environment.',
          statusCode: 503,
        });
      }
      fastify.log.error(err);
      return reply.status(502).send({
        error: true,
        message: 'AI service temporarily unavailable. Please try again.',
        statusCode: 502,
      });
    }
  });
}
