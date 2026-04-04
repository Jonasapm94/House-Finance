import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import Knex from 'knex';
import { Model } from 'objection';
import { dashboardRoutes } from '../../routes/dashboard';
import { testDbConfig } from '../config';

describe('Dashboard API', () => {
  let app: FastifyInstance;
  let knex: ReturnType<typeof Knex>;

  beforeAll(async () => {
    knex = Knex({
      client: 'pg',
      connection: testDbConfig.connection,
      pool: { min: 1, max: 2 },
    });
    Model.knex(knex);

    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.decorate('knex', knex);
    await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await knex.destroy();
  });

  beforeEach(async () => {
    await knex('transactions').del();
  });

  async function createTransaction(data: {
    date: string;
    amount: number;
    description: string;
    type: 'income' | 'expense';
    external_id?: string;
    category_id?: number | null;
  }) {
    return knex('transactions').insert({
      date: data.date,
      amount: data.amount.toString(),
      description: data.description,
      type: data.type,
      source: 'manual',
      external_id: data.external_id || `test-${Date.now()}-${Math.random()}`,
      category_id: data.category_id ?? null,
    });
  }

  describe('GET /api/dashboard/summary', () => {
    it('should return zero when no transactions exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Number(body.totalIncome)).toBe(0);
      expect(Number(body.totalExpenses)).toBe(0);
      expect(Number(body.netBalance)).toBe(0);
    });

    it('should sum income and expense transactions correctly', async () => {
      await createTransaction({
        date: '2024-01-01',
        amount: 5000,
        description: 'Salary',
        type: 'income',
      });
      await createTransaction({
        date: '2024-01-02',
        amount: 200,
        description: 'Groceries',
        type: 'expense',
      });
      await createTransaction({
        date: '2024-01-03',
        amount: 50,
        description: 'Restaurant',
        type: 'expense',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Number(body.totalIncome)).toBe(5000);
      expect(Number(body.totalExpenses)).toBe(250);
      expect(Number(body.netBalance)).toBe(4750);
    });

    it('should include ALL transactions when no date filter is provided', async () => {
      await createTransaction({
        date: '2020-01-01',
        amount: 1000,
        description: 'Old income',
        type: 'income',
      });
      await createTransaction({
        date: '2024-01-01',
        amount: 2000,
        description: 'Recent income',
        type: 'income',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Number(body.totalIncome)).toBe(3000);
    });

    it('should filter transactions by date range', async () => {
      await createTransaction({
        date: '2020-01-01',
        amount: 1000,
        description: 'Old income',
        type: 'income',
      });
      await createTransaction({
        date: '2024-01-01',
        amount: 2000,
        description: 'Recent income',
        type: 'income',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary?from=2024-01-01&to=2024-12-31',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Number(body.totalIncome)).toBe(2000);
    });

    it('should filter transactions from a specific date', async () => {
      await createTransaction({
        date: '2024-01-01',
        amount: 1000,
        description: 'Jan income',
        type: 'income',
      });
      await createTransaction({
        date: '2024-06-01',
        amount: 2000,
        description: 'Jun income',
        type: 'income',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary?from=2024-06-01',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Number(body.totalIncome)).toBe(2000);
    });
  });

  describe('GET /api/dashboard/category-breakdown', () => {
    beforeEach(async () => {
      await knex('categories').del();
      await knex('categories').insert([
        { id: 1, name: 'Groceries', color: '#22c55e' },
        { id: 2, name: 'Entertainment', color: '#3b82f6' },
      ]);
    });

    it('should return empty array when no transactions exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/category-breakdown',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(0);
    });

    it('should include ALL expense transactions when no date filter is provided', async () => {
      await createTransaction({
        date: '2020-01-01',
        amount: 500,
        description: 'Old groceries',
        type: 'expense',
        category_id: 1,
      });
      await createTransaction({
        date: '2024-01-01',
        amount: 300,
        description: 'Recent groceries',
        type: 'expense',
        category_id: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/category-breakdown',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].category).toBe('Groceries');
      expect(Number(body[0].amount)).toBe(800);
    });

    it('should filter by date range', async () => {
      await createTransaction({
        date: '2020-01-01',
        amount: 500,
        description: 'Old groceries',
        type: 'expense',
        category_id: 1,
      });
      await createTransaction({
        date: '2024-01-01',
        amount: 300,
        description: 'Recent groceries',
        type: 'expense',
        category_id: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/category-breakdown?from=2024-01-01&to=2024-12-31',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(Number(body[0].amount)).toBe(300);
    });

    it('should group uncategorized transactions under "Uncategorized"', async () => {
      await createTransaction({
        date: '2024-01-01',
        amount: 100,
        description: 'Misc expense',
        type: 'expense',
        category_id: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/category-breakdown',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].category).toBe('Uncategorized');
      expect(Number(body[0].amount)).toBe(100);
    });
  });

  describe('GET /api/dashboard/monthly-trend', () => {
    it('should return empty array when no transactions exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/monthly-trend',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(0);
    });

    it('should aggregate transactions by month', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await createTransaction({
        date: `${thisMonth}-15`,
        amount: 1000,
        description: 'This month income',
        type: 'income',
      });
      await createTransaction({
        date: `${thisMonth}-20`,
        amount: 200,
        description: 'This month expense',
        type: 'expense',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/monthly-trend?months=3',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const thisMonthData = body.find((m: { month: string }) => m.month === thisMonth);
      expect(thisMonthData).toBeDefined();
      expect(Number(thisMonthData.income)).toBe(1000);
      expect(Number(thisMonthData.expenses)).toBe(200);
    });

    it('should include all months within the specified range', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await createTransaction({
        date: `${thisMonth}-15`,
        amount: 500,
        description: 'This month expense',
        type: 'expense',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/monthly-trend?months=3',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBeGreaterThanOrEqual(1);
      const thisMonthData = body.find((m: { month: string }) => m.month === thisMonth);
      expect(thisMonthData).toBeDefined();
      expect(Number(thisMonthData.expenses)).toBe(500);
    });
  });
});
