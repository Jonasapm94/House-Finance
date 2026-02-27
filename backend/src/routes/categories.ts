import { FastifyInstance } from 'fastify';

export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  // Will be implemented in the category CRUD epic
  fastify.get('/health', async () => ({ route: 'categories', status: 'ok' }));
}
