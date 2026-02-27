import type { Knex } from 'knex';

const baseConfig: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: 'localhost',
    port: 5432,
    user: 'finance_user',
    password: 'finance_pass',
    database: 'house_finance',
  },
  migrations: {
    directory: __dirname + '/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: __dirname + '/seeds',
    extension: 'ts',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

const knexConfig: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
  },
  test: {
    ...baseConfig,
    connection: process.env.TEST_DATABASE_URL || {
      host: 'localhost',
      port: 5432,
      user: 'finance_user',
      password: 'finance_pass',
      database: 'house_finance_test',
    },
  },
  production: {
    ...baseConfig,
  },
};

export default knexConfig;
