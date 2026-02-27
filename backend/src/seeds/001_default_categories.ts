import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Upsert default "Uncategorized" category
  const existing = await knex('categories').where('name', 'Uncategorized').first();
  if (!existing) {
    await knex('categories').insert({
      name: 'Uncategorized',
      color: '#94a3b8',
    });
  }
}
