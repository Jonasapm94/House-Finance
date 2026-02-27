import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('import_logs', (table) => {
    table.increments('id').primary();
    table.string('filename', 255).notNullable();
    table.timestamp('imported_at').notNullable().defaultTo(knex.fn.now());
    table.integer('total_count').notNullable().defaultTo(0);
    table.integer('new_count').notNullable().defaultTo(0);
    table.integer('duplicate_count').notNullable().defaultTo(0);
    table.integer('categorized_count').notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('import_logs');
}
