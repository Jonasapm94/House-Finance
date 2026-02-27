import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create enum
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE rule_match_type AS ENUM ('substring', 'regex', 'exact');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.schema.createTable('categorization_rules', (table) => {
    table.increments('id').primary();
    table
      .integer('category_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('categories')
      .onDelete('CASCADE');
    table.text('pattern').notNullable();
    table
      .specificType('match_type', 'rule_match_type')
      .notNullable()
      .defaultTo('substring');
    table.integer('priority').notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.index('priority');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('categorization_rules');
  await knex.raw('DROP TYPE IF EXISTS rule_match_type');
}
