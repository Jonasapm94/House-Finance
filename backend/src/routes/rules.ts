import { FastifyInstance } from 'fastify';

export async function ruleRoutes(fastify: FastifyInstance): Promise<void> {
  // Will be implemented in the rules epic
  fastify.get('/health', async () => ({ route: 'rules', status: 'ok' }));
}
