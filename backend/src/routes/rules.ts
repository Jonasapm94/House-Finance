import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CategorizationRule } from '../models/CategorizationRule';
import { CategorizationService } from '../services/CategorizationService';
import { CreateRuleSchema, UpdateRuleSchema, IdParamSchema } from '../validators/schemas';

export async function ruleRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/rules — List all rules
  app.get('/', async () => {
    return CategorizationRule.query()
      .withGraphFetched('category')
      .orderBy('priority', 'desc')
      .orderBy('id', 'asc');
  });

  // GET /api/rules/:id — Get single rule
  app.get(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const rule = await CategorizationRule.query()
        .findById(id)
        .withGraphFetched('category');

      if (!rule) {
        return reply.status(404).send({
          error: true,
          message: 'Rule not found',
          statusCode: 404,
        });
      }

      return rule;
    },
  );

  // POST /api/rules — Create rule
  app.post(
    '/',
    {
      schema: {
        body: CreateRuleSchema,
      },
    },
    async (request, reply) => {
      const { category_id, pattern, match_type, priority } = request.body;

      // Validate regex pattern if match_type is regex
      if (match_type === 'regex') {
        try {
          new RegExp(pattern);
        } catch {
          return reply.status(400).send({
            error: true,
            message: 'Invalid regex pattern',
            statusCode: 400,
          });
        }
      }

      const rule = await CategorizationRule.query().insert({
        category_id,
        pattern,
        match_type,
        priority,
      });

      const full = await CategorizationRule.query()
        .findById(rule.id)
        .withGraphFetched('category');

      return reply.status(201).send(full);
    },
  );

  // PUT /api/rules/:id — Update rule
  app.put(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
        body: UpdateRuleSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const rule = await CategorizationRule.query().findById(id);
      if (!rule) {
        return reply.status(404).send({
          error: true,
          message: 'Rule not found',
          statusCode: 404,
        });
      }

      // Validate regex if changing to or already is regex
      const finalMatchType = updates.match_type ?? rule.match_type;
      const finalPattern = updates.pattern ?? rule.pattern;
      if (finalMatchType === 'regex') {
        try {
          new RegExp(finalPattern);
        } catch {
          return reply.status(400).send({
            error: true,
            message: 'Invalid regex pattern',
            statusCode: 400,
          });
        }
      }

      const updated = await CategorizationRule.query().patchAndFetchById(id, updates);

      const full = await CategorizationRule.query()
        .findById(updated.id)
        .withGraphFetched('category');

      return full;
    },
  );

  // DELETE /api/rules/:id — Delete rule
  app.delete(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const rule = await CategorizationRule.query().findById(id);
      if (!rule) {
        return reply.status(404).send({
          error: true,
          message: 'Rule not found',
          statusCode: 404,
        });
      }

      await CategorizationRule.query().deleteById(id);

      return reply.status(200).send({ message: 'Rule deleted' });
    },
  );

  // POST /api/rules/apply — Re-apply all rules to uncategorized transactions
  app.post('/apply', async () => {
    const result = await CategorizationService.recategorizeUncategorized();
    return result;
  });
}
