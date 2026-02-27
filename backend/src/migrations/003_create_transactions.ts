import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create enums
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE transaction_type AS ENUM ('income', 'expense');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE transaction_source AS ENUM ('ofx', 'csv', 'manual');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.schema.createTable('transactions', (table) => {
    table.increments('id').primary();
    table.string('external_id', 255).nullable().unique();
    table
      .integer('category_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('categories')
      .onDelete('SET NULL');
    table
      .integer('account_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('accounts')
      .onDelete('SET NULL');
    table.date('date').notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.text('description').notNullable();
    table.specificType('type', 'transaction_type').notNullable();
    table
      .specificType('source', 'transaction_source')
      .notNullable()
      .defaultTo('manual');
    table.timestamps(true, true);

    // Indexes for common queries
    table.index('date');
    table.index('category_id');
    table.index('type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions');
  await knex.raw('DROP TYPE IF EXISTS transaction_source');
  await knex.raw('DROP TYPE IF EXISTS transaction_type');
}
