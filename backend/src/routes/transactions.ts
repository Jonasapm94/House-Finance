import { FastifyInstance } from 'fastify';

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {
  // Will be implemented in the transaction CRUD epic
  fastify.get('/health', async () => ({ route: 'transactions', status: 'ok' }));
}
