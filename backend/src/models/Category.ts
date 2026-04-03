import { BaseModel } from './BaseModel';
import type { RelationMappings } from 'objection';

export class Category extends BaseModel {
  static tableName = 'categories';

  name!: string;
  color!: string;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        color: { type: 'string', maxLength: 7 },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    // Lazy require to avoid circular dependencies (Objection.js pattern)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Transaction } = require('./Transaction');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CategorizationRule } = require('./CategorizationRule');

    return {
      transactions: {
        relation: BaseModel.HasManyRelation,
        modelClass: Transaction,
        join: {
          from: 'categories.id',
          to: 'transactions.category_id',
        },
      },
      rules: {
        relation: BaseModel.HasManyRelation,
        modelClass: CategorizationRule,
        join: {
          from: 'categories.id',
          to: 'categorization_rules.category_id',
        },
      },
    };
  }
}
