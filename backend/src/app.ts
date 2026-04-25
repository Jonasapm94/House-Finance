import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { databasePlugin } from './plugins/database';
import { uploadRoutes } from './routes/upload';
import { categoryRoutes } from './routes/categories';
import { transactionRoutes } from './routes/transactions';
import { ruleRoutes } from './routes/rules';
import { dashboardRoutes } from './routes/dashboard';
import { aiCategorizationRoutes } from './routes/aiCategorization';

export async function buildApp(
  opts: { logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? true,
  }).withTypeProvider<ZodTypeProvider>();

  // Set Zod as the validator/serializer
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(helmet, { global: true });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  });

  // Database
  await app.register(databasePlugin);

  // Global error handler
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    app.log.error(error);

    reply.status(statusCode).send({
      error: true,
      message: error.message,
      statusCode,
      ...(error.validation && { validation: error.validation }),
    });
  });

  // Routes
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(categoryRoutes, { prefix: '/api/categories' });
  await app.register(transactionRoutes, { prefix: '/api/transactions' });
  await app.register(ruleRoutes, { prefix: '/api/rules' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(aiCategorizationRoutes, { prefix: '/api/ai-categorization' });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
