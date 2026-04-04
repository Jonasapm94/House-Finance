import type { Knex } from 'knex';
import { DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_COLOR } from '../constants';

export async function seed(knex: Knex): Promise<void> {
  // Upsert default category
  const existing = await knex('categories').where('name', DEFAULT_CATEGORY_NAME).first();
  if (!existing) {
    await knex('categories').insert({
      name: DEFAULT_CATEGORY_NAME,
      color: DEFAULT_CATEGORY_COLOR,
    });
  }
}
