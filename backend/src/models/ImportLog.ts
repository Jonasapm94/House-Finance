import { Model } from 'objection';

export class ImportLog extends Model {
  static tableName = 'import_logs';

  id!: number;
  filename!: string;
  imported_at!: string;
  total_count!: number;
  new_count!: number;
  duplicate_count!: number;
  categorized_count!: number;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['filename'],
      properties: {
        id: { type: 'integer' },
        filename: { type: 'string', minLength: 1, maxLength: 255 },
        total_count: { type: 'integer' },
        new_count: { type: 'integer' },
        duplicate_count: { type: 'integer' },
        categorized_count: { type: 'integer' },
      },
    };
  }
}
