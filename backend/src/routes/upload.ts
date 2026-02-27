import { FastifyInstance } from 'fastify';

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // Will be implemented in the upload epic
  fastify.get('/health', async () => ({ route: 'upload', status: 'ok' }));
}
