import fp from 'fastify-plugin';
import Knex from 'knex';
import { Model } from 'objection';
import { FastifyInstance } from 'fastify';
import knexConfig from '../knexfile';

export const databasePlugin = fp(async (fastify: FastifyInstance) => {
  const env = (process.env.NODE_ENV || 'development') as keyof typeof knexConfig;
  const knex = Knex(knexConfig[env]);

  // Bind Objection.js to the Knex instance
  Model.knex(knex);

  // Make knex available on the fastify instance
  fastify.decorate('knex', knex);

  fastify.addHook('onClose', async () => {
    await knex.destroy();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    knex: ReturnType<typeof Knex>;
  }
}
