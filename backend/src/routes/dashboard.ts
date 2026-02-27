import { FastifyInstance } from 'fastify';

export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // Will be implemented in the dashboard epic
  fastify.get('/health', async () => ({ route: 'dashboard', status: 'ok' }));
}
