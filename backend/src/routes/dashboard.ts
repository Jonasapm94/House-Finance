import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  DashboardQuerySchema,
  MonthlyTrendQuerySchema,
} from '../validators/schemas';
import {
  DEFAULT_CATEGORY_NAME,
  DEFAULT_CATEGORY_COLOR,
} from '../constants';

export async function dashboardRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/dashboard/summary — Total income, expenses, net balance
  app.get(
    '/summary',
    {
      schema: {
        querystring: DashboardQuerySchema,
      },
    },
    async (request) => {
      const { from, to } = request.query;
      const knex = fastify.knex;

      let query = knex('transactions');

      if (from) {
        query = query.where('date', '>=', from);
      }
      if (to) {
        query = query.where('date', '<=', to);
      }

      const result = await query.select(
        knex.raw(
          "COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as \"totalIncome\"",
        ),
        knex.raw(
          "COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as \"totalExpenses\"",
        ),
        knex.raw(
          "COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as \"netBalance\"",
        ),
      );

      return result[0];
    },
  );

  // GET /api/dashboard/monthly-trend — Income vs expenses per month
  app.get(
    '/monthly-trend',
    {
      schema: {
        querystring: MonthlyTrendQuerySchema,
      },
    },
    async (request) => {
      const { months } = request.query;
      const knex = fastify.knex;

      const result = await knex('transactions')
        .select(
          knex.raw("TO_CHAR(date, 'YYYY-MM') as month"),
          knex.raw(
            "COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income",
          ),
          knex.raw(
            "COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses",
          ),
        )
        .where(
          'date',
          '>=',
          knex.raw(`CURRENT_DATE - INTERVAL '${months} months'`),
        )
        .groupByRaw("TO_CHAR(date, 'YYYY-MM')")
        .orderByRaw("TO_CHAR(date, 'YYYY-MM') ASC");

      return result;
    },
  );

  // GET /api/dashboard/category-breakdown — Expenses by category
  app.get(
    '/category-breakdown',
    {
      schema: {
        querystring: DashboardQuerySchema,
      },
    },
    async (request) => {
      const { from, to } = request.query;
      const knex = fastify.knex;

      let query = knex('transactions')
        .leftJoin('categories', 'transactions.category_id', 'categories.id')
        .where('transactions.type', 'expense')
        .select(
          knex.raw(
            `COALESCE(categories.name, '${DEFAULT_CATEGORY_NAME}') as category`,
          ),
          knex.raw('SUM(transactions.amount) as amount'),
          knex.raw(
            `COALESCE(categories.color, '${DEFAULT_CATEGORY_COLOR}') as color`,
          ),
        )
        .groupByRaw(
          `COALESCE(categories.name, '${DEFAULT_CATEGORY_NAME}'), COALESCE(categories.color, '${DEFAULT_CATEGORY_COLOR}')`,
        )
        .orderBy('amount', 'desc');

      if (from) {
        query = query.where('transactions.date', '>=', from);
      }
      if (to) {
        query = query.where('transactions.date', '<=', to);
      }

      return query;
    },
  );
}
