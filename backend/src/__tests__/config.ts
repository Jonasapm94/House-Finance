import type { Knex } from 'knex';
import knexConfig from '../knexfile';

export const testDbConfig: Knex.Config = knexConfig.test as Knex.Config;
