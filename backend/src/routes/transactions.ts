import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Transaction } from '../models/Transaction';
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  IdParamSchema,
  TransactionFilterSchema,
} from '../validators/schemas';

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/transactions — List transactions (paginated, filterable)
  app.get(
    '/',
    {
      schema: {
        querystring: TransactionFilterSchema,
      },
    },
    async (request) => {
      const { page, limit, from, to, category_id, type, search } = request.query;

      const query = Transaction.query()
        .withGraphFetched('category')
        .orderBy('date', 'desc')
        .orderBy('id', 'desc');

      if (from) {
        query.where('date', '>=', from);
      }
      if (to) {
        query.where('date', '<=', to);
      }
      if (category_id) {
        if (category_id === 'uncategorized') {
          query.whereNull('category_id');
        } else {
          query.where('category_id', category_id);
        }
      }
      if (type) {
        query.where('type', type);
      }
      if (search) {
        query.where('description', 'ilike', `%${search}%`);
      }

      const offset = (page - 1) * limit;

      // Get total count for pagination
      const countQuery = query.clone().resultSize();
      const dataQuery = query.offset(offset).limit(limit);

      const [data, total] = await Promise.all([dataQuery, countQuery]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  );

  // GET /api/transactions/:id — Get single transaction
  app.get(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const transaction = await Transaction.query()
        .findById(id)
        .withGraphFetched('category');

      if (!transaction) {
        return reply.status(404).send({
          error: true,
          message: 'Transaction not found',
          statusCode: 404,
        });
      }

      return transaction;
    },
  );

  // POST /api/transactions — Create manual transaction
  app.post(
    '/',
    {
      schema: {
        body: CreateTransactionSchema,
      },
    },
    async (request, reply) => {
      const { date, amount, description, type, category_id, account_id } = request.body;

      const transaction = await Transaction.query().insert({
        date,
        amount: amount.toString(),
        description,
        type,
        source: 'manual',
        category_id: category_id ?? null,
        account_id: account_id ?? null,
      });

      const full = await Transaction.query()
        .findById(transaction.id)
        .withGraphFetched('category');

      return reply.status(201).send(full);
    },
  );

  // PUT /api/transactions/:id — Update transaction
  app.put(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
        body: UpdateTransactionSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const transaction = await Transaction.query().findById(id);
      if (!transaction) {
        return reply.status(404).send({
          error: true,
          message: 'Transaction not found',
          statusCode: 404,
        });
      }

      const patchData: Record<string, unknown> = { ...updates };
      if (updates.amount !== undefined) {
        patchData.amount = updates.amount.toString();
      }

      const updated = await Transaction.query()
        .patchAndFetchById(id, patchData)
        .withGraphFetched('category');

      return updated;
    },
  );

  // DELETE /api/transactions/:id — Delete transaction
  app.delete(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const transaction = await Transaction.query().findById(id);
      if (!transaction) {
        return reply.status(404).send({
          error: true,
          message: 'Transaction not found',
          statusCode: 404,
        });
      }

      await Transaction.query().deleteById(id);

      return reply.status(200).send({ message: 'Transaction deleted' });
    },
  );
}
